import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext, listLabels, reservationDates } from "@/lib/event-map";
import { downloadLogo } from "@/lib/event-logo";
import { buildSignPages, signsFilename } from "@/lib/signs/build-pages";
import { renderDoorSigns, type SignVariant } from "@/lib/signs/door-signs";
import { shareUnlocked, signsUnlocked } from "@/lib/signs/gate";
import { enableShare, getShare, shareState } from "@/lib/event-share";

// ─── GET /api/event-map/[reservationId]/signs ────────────────────────────────
// ?variant=public|staff   staff copies carry the setup line and notes (staff only)
// ?room=<map room id>     just that room's page(s)
// ?day=<index>            staff: only that day's page for rooms that vary by day
// ?inline=1               open in the browser instead of downloading
//
// Who: anyone who can edit the event map (owner, co-owner, staff).
// When: once the reservation is approved and the logo is approved (or there is
// no logo). Staff can always generate — that's how the office previews a set.
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ reservationId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(req: NextRequest, ctx: Ctx) {
  const { reservationId } = await ctx.params;
  if (!UUID.test(reservationId)) return NextResponse.json({ error: "Invalid reservation id" }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = adminClient();
  const mapCtx = await getEventMapContext(db, { id: user.id, email: user.email }, reservationId);
  if (!mapCtx) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (mapCtx.access !== "edit") return NextResponse.json({ error: "View only" }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const variant: SignVariant = q.get("variant") === "staff" ? "staff" : "public";
  if (variant === "staff" && !mapCtx.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const gate = signsUnlocked(mapCtx.reservation, mapCtx.staff);
  if (!gate.ok) return NextResponse.json({ error: gate.why }, { status: 403 });

  const onlyRoom = q.get("room");
  const dayRaw = q.get("day");
  const onlyDay = dayRaw !== null && /^\d+$/.test(dayRaw) ? Number(dayRaw) : null;

  const r = mapCtx.reservation;
  const [labels, logoPng, shareRow] = await Promise.all([listLabels(db, r.id, mapCtx.staff), downloadLogo(db, r), getShare(db, r.id)]);
  const pages = buildSignPages({ payload: r.payload, labels, variant, onlyRoom, onlyDay });
  if (!pages.length) return NextResponse.json({ error: "Nothing to print yet — name a room on the event map first." }, { status: 422 });

  const origin = req.nextUrl.origin;
  const { data: optRow } = await db.from("reservations").select("sign_options").eq("id", r.id).maybeSingle();
  const qrSetting = (optRow?.sign_options as { qr?: boolean } | null)?.qr !== false;
  const qrParam = q.get("qr");
  const withQr = qrParam === null ? qrSetting : qrParam !== "0" && qrParam !== "false";
  // The QR is for attendees: it opens the shared event map on that room. Printing a public set for an
  // approved event turns the link on if it's off (the planner can still turn it off later); a staff preview
  // of an unapproved event falls back to the plain building map.
  let share = shareState(shareRow);
  if (variant === "public" && withQr && !share.enabled && shareUnlocked(r, false).ok) {
    try { share = await enableShare(db, r.id, user.id); } catch { /* the fallback below still works */ }
  }
  const qrUrlFor = withQr ? (roomId: string) => (share.token ? `${origin}/bx-map?event=${share.token}#${roomId}` : `${origin}/bx-map#${roomId}`) : null;

  const bytes = await renderDoorSigns({
    eventName: r.event_name,
    dates: reservationDates(r.payload),
    bookingNumber: r.booking_number,
    variant,
    pages,
    logoPng,
    qrUrlFor,
  });
  const name = signsFilename(r.event_name, variant, onlyRoom);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${q.get("inline") ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Sign-Pages": String(pages.length),
    },
  });
}

// PATCH { qr: boolean } — the planner's sign options (anyone who can edit the map)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { reservationId } = await ctx.params;
  if (!UUID.test(reservationId)) return NextResponse.json({ error: "Invalid reservation id" }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const db = adminClient();
  const mapCtx = await getEventMapContext(db, { id: user.id, email: user.email }, reservationId);
  if (!mapCtx) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (mapCtx.access !== "edit") return NextResponse.json({ error: "View only" }, { status: 403 });
  let body: { qr?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (typeof body.qr !== "boolean") return NextResponse.json({ error: "qr must be true or false" }, { status: 400 });
  const { data: cur } = await db.from("reservations").select("sign_options").eq("id", reservationId).maybeSingle();
  const next = { ...((cur?.sign_options as Record<string, unknown> | null) ?? {}), qr: body.qr };
  const { error } = await db.from("reservations").update({ sign_options: next }).eq("id", reservationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ qr: body.qr });
}
