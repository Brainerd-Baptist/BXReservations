import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import {
  LOGO_TYPES,
  createLogoUploadSlot,
  finalizeLogoUpload,
  logoState,
  readLogoRow,
  removeLogo,
  reviewLogo,
} from "@/lib/event-logo";
import { notifyLogoReviewed, notifyLogoUploaded } from "@/lib/logo-notify";

// ─── /api/event-map/[reservationId]/logo ─────────────────────────────────────
// GET    → { status, meta, previewUrl, reviewedAt }        anyone with map access
// PUT    → { mime }            → { path, token }           editors: a signed upload slot
// POST   → { path, mime, name } → LogoState                editors: the file landed; normalise + queue review
// DELETE →                     → LogoState                editors: remove the logo
// PATCH  → { decision: "approve"|"reject", note? } → LogoState   staff only
//
// sharp runs here, so this stays on the Node runtime with room to work.
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ reservationId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolve(ctx: Ctx) {
  const { reservationId } = await ctx.params;
  if (!UUID.test(reservationId)) {
    return { error: NextResponse.json({ error: "Invalid reservation id" }, { status: 400 }) };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const db = adminClient();
  const mapCtx = await getEventMapContext(db, { id: user.id, email: user.email }, reservationId);
  if (!mapCtx) return { error: NextResponse.json({ error: "Reservation not found" }, { status: 404 }) };
  const row = await readLogoRow(db, reservationId);
  if (!row) return { error: NextResponse.json({ error: "Reservation not found" }, { status: 404 }) };
  return { db, user, mapCtx, row };
}

const fail = (e: unknown, status = 422) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong" }, { status });

export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  return NextResponse.json(await logoState(r.db, r.row));
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  if (r.mapCtx.access !== "edit") return NextResponse.json({ error: "View only" }, { status: 403 });
  let body: { mime?: string; bytes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const mime = String(body.mime ?? "");
  if (!LOGO_TYPES[mime]) return NextResponse.json({ error: "Use a PNG, JPG or SVG" }, { status: 422 });
  if (typeof body.bytes === "number" && body.bytes > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Files up to 10 MB" }, { status: 422 });
  }
  try {
    return NextResponse.json(await createLogoUploadSlot(r.db, r.row.id, mime));
  } catch (e) {
    return fail(e, 500);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  if (r.mapCtx.access !== "edit") return NextResponse.json({ error: "View only" }, { status: 403 });
  let body: { path?: string; mime?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const mime = String(body.mime ?? "");
  if (!LOGO_TYPES[mime] || typeof body.path !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const state = await finalizeLogoUpload(r.db, r.row, body.path, mime, r.user.id, body.name);
    // staff uploading on a planner's behalf still goes through review — one path, no surprises
    after(() => notifyLogoUploaded(r.db, { ...r.row, logo_status: "pending" }).catch((e) => console.error("[logo] notify", e)));
    return NextResponse.json(state);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  if (r.mapCtx.access !== "edit") return NextResponse.json({ error: "View only" }, { status: 403 });
  try {
    return NextResponse.json(await removeLogo(r.db, r.row));
  } catch (e) {
    return fail(e, 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  if (!r.mapCtx.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  let body: { decision?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null;
  if (!decision) return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.replace(/\s+/g, " ").trim().slice(0, 300) || null : null;
  try {
    const state = await reviewLogo(r.db, r.row, decision, note, r.user.id);
    after(() => notifyLogoReviewed(r.db, r.row, decision, note).catch((e) => console.error("[logo] notify", e)));
    return NextResponse.json(state);
  } catch (e) {
    return fail(e);
  }
}
