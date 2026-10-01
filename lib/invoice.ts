import type { SupabaseClient } from "@supabase/supabase-js";
import { getBilling } from "@/lib/billing";
import { readVenue } from "@/lib/venue";
import { venueToday, includedDates } from "@/lib/dates";
import { renderInvoice } from "@/lib/invoice-pdf";

type Day = { date: string; included?: boolean; customStart?: string; customEnd?: string; rooms?: { roomId: string; requested?: boolean }[] };

/** Build the invoice (or paid receipt) PDF for a booking. `db` = service client. */
export async function buildInvoice(db: SupabaseClient, reservationId: string) {
  const { data: r } = await db
    .from("reservations")
    .select("id, booking_number, event_name, status, contact_name, contact_org, contact_email, contact_phone, payload")
    .eq("id", reservationId).maybeSingle();
  if (!r) return null;
  const [billing, venue] = await Promise.all([getBilling(db, r.id), readVenue(db)]);
  const days = (((r.payload as { days?: Day[] } | null)?.days ?? []) as Day[])
    .filter((d) => d.included !== false && includedDates({ days: [d] }).length)
    .map((d) => ({ date: d.date, start: d.customStart, end: d.customEnd, rooms: (d.rooms ?? []).map((x) => x.roomId) }));
  const bytes = await renderInvoice({
    bookingNumber: r.booking_number ?? r.id.slice(0, 8),
    eventName: r.event_name || "Your event",
    status: r.status,
    contact: { name: r.contact_name || r.contact_email || "", org: r.contact_org, email: r.contact_email, phone: r.contact_phone },
    days,
    billing,
    venue: { name: venue.venue_name, address: venue.venue_address },
    issuedYmd: venueToday(),
    paymentNote: venue.venue_payment,
  });
  const paid = billing.totals.balance <= 0 && billing.totals.charges > 0;
  return {
    bytes,
    filename: `${paid ? "Receipt" : "Invoice"}-${r.booking_number ?? r.id.slice(0, 8)}.pdf`,
    paid,
    billing,
    reservation: r,
  };
}
