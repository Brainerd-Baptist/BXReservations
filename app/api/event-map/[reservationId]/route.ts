import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  adminClient,
  applyChanges,
  buildEventLayer,
  getEventMapContext,
  type EventMapChange,
} from "@/lib/event-map";
import { MAP_ROOM_IDS } from "@/app/bx-map/map-bundle";

// ─── /api/event-map/[reservationId] ──────────────────────────────────────────
// GET → the event layer the map page mounts with (labels, dates, rooms, mode)
// PUT → { changes: EventMapChange[] } from the page's autosave
//
// Authorization lives in lib/event-map.ts (getEventMapContext) and is
// mirrored by RLS in supabase/migrations/20260926_event_map.sql.

type Ctx = { params: Promise<{ reservationId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolve(req: NextRequest, ctx: Ctx) {
  const { reservationId } = await ctx.params;
  if (!UUID.test(reservationId)) {
    return { error: NextResponse.json({ error: "Invalid reservation id" }, { status: 400 }) };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const db = adminClient();
  const mapCtx = await getEventMapContext(db, { id: user.id, email: user.email }, reservationId);
  if (!mapCtx) {
    return { error: NextResponse.json({ error: "Reservation not found" }, { status: 404 }) };
  }
  return { db, user, mapCtx };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const layer = await buildEventLayer(r.db, r.mapCtx);
  return NextResponse.json(layer, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  if (r.mapCtx.access !== "edit") {
    return NextResponse.json({ error: "You can view this event map but not change it" }, { status: 403 });
  }

  let body: { changes?: EventMapChange[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const changes = Array.isArray(body?.changes) ? body.changes.slice(0, 200) : null;
  if (!changes || !changes.length) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const result = await applyChanges(r.db, r.mapCtx, changes, r.user.id, new Set(MAP_ROOM_IDS));
  if (result.applied === 0 && result.rejected > 0) {
    return NextResponse.json({ error: "Nothing could be saved", ...result }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...result });
}
