import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext, listLabels, reservationDates } from "@/lib/event-map";
import { downloadLogo } from "@/lib/event-logo";
import { buildSignPages } from "@/lib/signs/build-pages";
import { renderArrowSigns, type Direction } from "@/lib/signs/arrow-signs";
import { signsUnlocked } from "@/lib/signs/gate";

// GET /api/event-map/[reservationId]/arrows — directional signs for every room
// ?dir=left,right,ahead,up,down (default all) · ?inline=1 to open in the browser
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ reservationId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIRS: Direction[] = ["left", "right", "ahead", "up", "down"];

export async function GET(req: NextRequest, ctx: Ctx) {
  const { reservationId } = await ctx.params;
  if (!UUID.test(reservationId)) return NextResponse.json({ error: "Invalid reservation id" }, { status: 400 });
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const db = adminClient();
  const mapCtx = await getEventMapContext(db, { id: user.id, email: user.email }, reservationId);
  if (!mapCtx) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (mapCtx.access !== "edit") return NextResponse.json({ error: "View only" }, { status: 403 });
  const gate = signsUnlocked(mapCtx.reservation, mapCtx.staff);
  if (!gate.ok) return NextResponse.json({ error: gate.why }, { status: 403 });

  const r = mapCtx.reservation;
  const [labels, logoPng] = await Promise.all([listLabels(db, r.id, mapCtx.staff), downloadLogo(db, r)]);
  const pages = buildSignPages({ payload: r.payload, labels, variant: "public" });
  const wanted = (req.nextUrl.searchParams.get("dir") ?? "").split(",").filter((d): d is Direction => DIRS.includes(d as Direction));
  const bytes = await renderArrowSigns({
    eventName: r.event_name, dates: reservationDates(r.payload), bookingNumber: r.booking_number,
    pages, logoPng, directions: wanted,
  });
  const safe = (r.event_name || "event").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "event";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("inline") ? "inline" : "attachment"}; filename="${safe}-directional-signs.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
