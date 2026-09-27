import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext, listLabels } from "@/lib/event-map";
import { renderSetupSheet } from "@/lib/signs/setup-sheet";
import { signsFilename } from "@/lib/signs/build-pages";

// ─── GET /api/event-map/[reservationId]/setup-sheet — staff only ─────────────
// The crew's brief: every reserved room's setup, counts, notes and staff notes,
// grouped by day, plus the wayfinding signs to hang. ?inline=1 to view.
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
  if (!mapCtx.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const r = mapCtx.reservation;
  const [labels, { data: extra }] = await Promise.all([
    listLabels(db, r.id, true),
    db.from("reservations").select("contact_name, contact_org, contact_phone").eq("id", r.id).maybeSingle(),
  ]);
  const days = ((r.payload as { days?: { headcount?: number }[] } | null)?.days ?? []);
  const headcount = Math.max(0, ...days.map((d) => Number(d?.headcount) || 0)) || null;
  const bytes = await renderSetupSheet({
    eventName: r.event_name,
    bookingNumber: r.booking_number,
    contactName: extra?.contact_name as string | null,
    contactOrg: extra?.contact_org as string | null,
    contactPhone: extra?.contact_phone as string | null,
    payload: r.payload,
    labels,
    headcount,
  });
  const name = signsFilename(r.event_name, "public").replace("-door-signs", "-setup-sheet");
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("inline") ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
