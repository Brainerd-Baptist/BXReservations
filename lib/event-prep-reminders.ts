/**
 * Event-prep reminder pipeline.
 *
 * Fires two emails per confirmed reservation:
 *   prep:30 — ~30 days before the event (or 7 days after confirmation if sooner)
 *   prep:7  — 7 days before the event (always, includes day-of logistics)
 *
 * Uses the same `reservation_payment_reminders` deduplication table as
 * payment reminders, with kind = "prep:30" | "prep:7".
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBilling, firstEventDate } from "@/lib/billing";
import { includedDates, daysFromToday, isClosedStatus } from "@/lib/dates";
import { readWaived } from "@/lib/waivers";
import { readLogoRow, logoState } from "@/lib/event-logo";
import { ROOMS } from "@/lib/rooms";
import { sendEventPrepEmail, type PaymentReadiness } from "@/lib/email";

// Rooms from a reservation payload → human-readable names
function roomNamesFromPayload(payload: unknown): string[] {
  const days = ((payload as { days?: unknown[] } | null)?.days ?? []) as Array<{
    included?: boolean;
    rooms?: Array<{ roomId?: string }>;
  }>;
  const ids = new Set<string>();
  for (const d of days) {
    if (d.included === false) continue;
    for (const r of d.rooms ?? []) {
      if (r.roomId) ids.add(r.roomId);
    }
  }
  return [...ids].map((id) => ROOMS.find((r) => r.id === id)?.name ?? id);
}

function maxHeadcount(payload: unknown): number {
  const days = ((payload as { days?: unknown[] } | null)?.days ?? []) as Array<{
    included?: boolean;
    headcount?: unknown;
  }>;
  let max = 0;
  for (const d of days) {
    if (d.included === false) continue;
    const n = Number(d.headcount ?? 0);
    if (n > max) max = n;
  }
  return max;
}

/**
 * Build a PaymentReadiness object for a reservation, fetching all live
 * readiness state from the DB.  `amountPaid` is 0 (this is a reminder,
 * not a receipt — the field is unused in sendEventPrepEmail).
 */
export async function buildReadiness(
  db: SupabaseClient,
  r: {
    id: string;
    booking_number: string | null;
    event_name: string | null;
    contact_name: string | null;
    contact_email: string | null;
    status: string;
    payload: unknown;
    coi_accepted_at: string | null;
    coi_uploaded_at: string | null;
    waived: unknown;
  },
): Promise<PaymentReadiness | null> {
  if (!r.contact_email) return null;

  const w = readWaived(r.waived);

  // Agreement
  const { data: agRow } = await db
    .from("reservation_agreements")
    .select("token, customer_signed_at")
    .eq("reservation_id", r.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Billing
  const { totals } = await getBilling(db, r.id);

  // Logo
  const logoRow = await readLogoRow(db, r.id);
  const logo = logoRow ? await logoState(db, logoRow) : null;

  // Room label count
  const { count: labelCount } = await db
    .from("event_map_labels")
    .select("id", { count: "exact", head: true })
    .eq("reservation_id", r.id);

  return {
    reservationId:   r.id,
    bookingNumber:   r.booking_number ?? r.id.slice(0, 8),
    contactName:     r.contact_name ?? "",
    contactEmail:    r.contact_email,
    eventName:       r.event_name ?? "your event",
    eventDates:      includedDates(r.payload),
    roomNames:       roomNamesFromPayload(r.payload),
    headcount:       maxHeadcount(r.payload),
    amountPaid:      0,
    totalPaid:       totals.paid,
    totalCharges:    totals.charges,
    agreementSigned: !!(agRow?.customer_signed_at),
    agreementToken:  (agRow?.token as string | null) ?? null,
    coiAccepted:     !!(r.coi_accepted_at),
    coiUploaded:     !!(r.coi_uploaded_at),
    logoUploaded:    logo !== null && logo.status !== "none",
    labelCount:      labelCount ?? 0,
    waivedAgreement: w.agreement,
    waivedCoi:       w.coi,
    waivedPayment:   w.payment,
  };
}

/**
 * Hourly job: send event-prep reminders at ~30 days and ~7 days out.
 */
export async function runEventPrepReminders(
  db: SupabaseClient,
): Promise<{ sent: number; errors: string[] }> {
  const WINDOWS = [
    { kind: "prep:30" as const, days: 30, min: 20, max: 35 },
    { kind: "prep:7"  as const, days: 7,  min: 5,  max: 9  },
  ];

  const { data: rows } = await db
    .from("reservations")
    .select(
      "id, booking_number, event_name, contact_name, contact_email, status, payload, coi_accepted_at, coi_uploaded_at, waived",
    )
    .in("status", ["confirmed"])
    .limit(500);

  let sent = 0;
  const errors: string[] = [];

  for (const r of rows ?? []) {
    if (isClosedStatus(r.status)) continue;
    const date = firstEventDate(r.payload);
    if (!date) continue;
    const away = daysFromToday(date);
    if (away < 0) continue; // event already past

    for (const window of WINDOWS) {
      if (away > window.max) continue; // too far out

      const kind = window.kind;
      const { data: already } = await db
        .from("reservation_payment_reminders")
        .select("id")
        .eq("reservation_id", r.id)
        .eq("kind", kind)
        .limit(1);
      if (already?.length) continue; // already sent this kind

      try {
        const readiness = await buildReadiness(db, r);
        if (!readiness) continue;

        await sendEventPrepEmail({ ...readiness, kind });
        await db.from("reservation_payment_reminders").insert({
          reservation_id: r.id,
          kind,
          balance: readiness.totalCharges - readiness.totalPaid,
          sent_to: r.contact_email,
          sent_by: null,
        });
        await db.from("reservation_history").insert({
          reservation_id: r.id,
          actor_id:   null,
          actor_role: "system",
          action:     "event_prep_reminder",
          note:       `Event prep reminder (${kind}) sent to ${r.contact_email}.`,
        });
        sent++;
      } catch (e) {
        errors.push(`${r.id} (${kind}): ${String(e)}`);
      }
    }
  }

  return { sent, errors };
}
