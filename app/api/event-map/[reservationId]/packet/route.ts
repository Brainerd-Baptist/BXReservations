import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext, listLabels } from "@/lib/event-map";
import { downloadLogo } from "@/lib/event-logo";
import { enableShare, getShare, shareState } from "@/lib/event-share";
import { readVenue } from "@/lib/venue";
import { renderPacket } from "@/lib/signs/packet";
import { signsFilename } from "@/lib/signs/build-pages";
import { shareUnlocked } from "@/lib/signs/gate";

// ─── GET /api/event-map/[reservationId]/packet ───────────────────────────────
// The attendee packet the planner emails ahead of time: cover, getting here,
// schedule and rooms, a labeled map of each level. Editors; unlocks with the
// reservation's approval (staff any time). ?inline=1 to preview in the browser.
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
  const gate = shareUnlocked(mapCtx.reservation, mapCtx.staff);
  if (!gate.ok) return NextResponse.json({ error: gate.why?.replace("The share link unlocks", "The packet unlocks") }, { status: 403 });

  const r = mapCtx.reservation;
  const [labels, logoPng, shareRow, venue] = await Promise.all([listLabels(db, r.id, false), downloadLogo(db, r), getShare(db, r.id), readVenue(db)]);
  // the packet points attendees at the shared map, so an approved event's link comes on with it
  let share = shareState(shareRow);
  if (!share.enabled && shareUnlocked(r, false).ok) {
    try { share = await enableShare(db, r.id, user.id); } catch { /* packet still renders without the link */ }
  }
  const bytes = await renderPacket({
    eventName: r.event_name,
    bookingNumber: r.booking_number,
    payload: r.payload,
    labels,
    venue,
    logoPng,
    shareUrl: share.path ? `${req.nextUrl.origin}${share.path}` : null,
  });
  const name = signsFilename(r.event_name, "public").replace("-door-signs", "-event-packet");
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("inline") ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
