import type { SupabaseClient } from "@supabase/supabase-js";
import { getBilling, firstEventDate } from "@/lib/billing";
import { formatYmd, daysFromToday, isClosedStatus } from "@/lib/dates";
import { sendPaymentReminder } from "@/lib/email";

/**
 * Email the requester their balance and log it. `kind` is "manual" or
 * "auto:<days>" — the hourly job sends each auto kind at most once.
 */
export async function sendBalanceReminder(
  db: SupabaseClient,
  reservationId: string,
  kind: string,
  sentBy: string | null,
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const { data: r } = await db
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, status, payload")
    .eq("id", reservationId)
    .maybeSingle();
  if (!r) return { ok: false, error: "Reservation not found" };
  if (!r.contact_email) return { ok: false, error: "This booking has no contact email." };
  const { totals } = await getBilling(db, r.id);
  if (totals.balance <= 0) return { ok: false, error: "Nothing is owed on this booking." };
  const date = firstEventDate(r.payload);
  await sendPaymentReminder({
    to: r.contact_email,
    name: r.contact_name || r.contact_email,
    bookingNumber: r.booking_number ?? r.id.slice(0, 8),
    reservationId: r.id,
    eventName: r.event_name || "your event",
    eventDate: date ? formatYmd(date) : null,
    charges: totals.charges,
    paid: totals.paid,
    balance: totals.balance,
  });
  await db.from("reservation_payment_reminders").insert({
    reservation_id: r.id, kind, balance: totals.balance, sent_to: r.contact_email, sent_by: sentBy,
  });
  await db.from("reservation_history").insert({
    reservation_id: r.id, actor_id: sentBy, actor_role: sentBy ? "admin" : "system",
    action: "payment_reminder",
    note: `Payment reminder sent to ${r.contact_email} (balance $${totals.balance.toFixed(2)}).`,
  });
  return { ok: true, balance: totals.balance };
}

/**
 * Hourly job: for open bookings with a balance, send reminder 1 and 2 when
 * the event is that many days away (or closer, if the window was missed).
 */
export async function runAutoReminders(db: SupabaseClient, days: number[]): Promise<{ sent: number; errors: string[] }> {
  const windows = [...new Set(days.filter((d) => d > 0))].sort((a, b) => b - a);
  if (!windows.length) return { sent: 0, errors: [] };
  const { data: rows } = await db
    .from("reservations")
    .select("id, status, payload")
    .limit(500);
  let sent = 0;
  const errors: string[] = [];
  for (const r of rows ?? []) {
    if (isClosedStatus(r.status) || ["declined", "expired", "pending"].includes(r.status ?? "")) continue;
    const date = firstEventDate(r.payload);
    if (!date) continue;
    const away = daysFromToday(date);
    if (away < 0) continue;
    // The smallest window we've reached — so a late-confirmed booking gets one reminder, not two at once
    const due = windows.filter((w) => away <= w).pop();
    if (due === undefined) continue;
    const kind = `auto:${due}`;
    const { data: already } = await db.from("reservation_payment_reminders").select("id").eq("reservation_id", r.id).eq("kind", kind).limit(1);
    if (already?.length) continue;
    const { totals } = await getBilling(db, r.id);
    if (totals.balance <= 0) continue;
    const res = await sendBalanceReminder(db, r.id, kind, null).catch((e) => ({ ok: false as const, error: String(e) }));
    if (res.ok) sent++;
    else errors.push(`${r.id}: ${res.error}`);
  }
  return { sent, errors };
}
