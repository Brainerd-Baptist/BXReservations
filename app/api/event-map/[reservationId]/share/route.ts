import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { disableShare, enableShare, getShare, shareState } from "@/lib/event-share";
import { shareUnlocked } from "@/lib/signs/gate";

// ─── /api/event-map/[reservationId]/share ────────────────────────────────────
// GET    → { enabled, token, path }                    editors
// POST   → { rotate?: boolean } → ShareState            editors: turn on (or issue a fresh link)
// DELETE →                     → ShareState            editors: turn off (old link stops working at once)

type Ctx = { params: Promise<{ reservationId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolve(ctx: Ctx) {
  const { reservationId } = await ctx.params;
  if (!UUID.test(reservationId)) return { error: NextResponse.json({ error: "Invalid reservation id" }, { status: 400 }) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const db = adminClient();
  const mapCtx = await getEventMapContext(db, { id: user.id, email: user.email }, reservationId);
  if (!mapCtx) return { error: NextResponse.json({ error: "Reservation not found" }, { status: 404 }) };
  if (mapCtx.access !== "edit") return { error: NextResponse.json({ error: "View only" }, { status: 403 }) };
  return { db, user, mapCtx };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  return NextResponse.json(shareState(await getShare(r.db, r.mapCtx.reservation.id)));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  const gate = shareUnlocked(r.mapCtx.reservation, r.mapCtx.staff);
  if (!gate.ok) return NextResponse.json({ error: gate.why }, { status: 403 });
  let rotate = false;
  try {
    const body = await req.json();
    rotate = !!body?.rotate;
  } catch {
    /* no body is fine */
  }
  try {
    return NextResponse.json(await enableShare(r.db, r.mapCtx.reservation.id, r.user.id, rotate));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't turn sharing on" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if ("error" in r) return r.error;
  try {
    return NextResponse.json(await disableShare(r.db, r.mapCtx.reservation.id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't turn sharing off" }, { status: 500 });
  }
}
