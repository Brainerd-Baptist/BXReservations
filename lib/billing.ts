import type { SupabaseClient } from "@supabase/supabase-js";
import { includedDates, isClosedStatus } from "@/lib/dates";

/** Money is stored as numeric; Supabase returns it as a string. */
export const money = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export type ChargeKind = "rental" | "addon" | "fee" | "discount";
export const CHARGE_KIND_LABEL: Record<ChargeKind, string> = {
  rental: "Room rental",
  addon: "Add-on",
  fee: "Fee",
  discount: "Discount",
};

export interface Addon {
  id: string;
  name: string;
  description: string | null;
  unit: "each" | "per_day" | "flat";
  price: number;
  active: boolean;
  sort: number;
  /** Only for bookings with one of these rooms (null = any room) */
  rooms?: string[] | null;
  /** Hour-tiered price (Complete AV package); see lib/addon-pricing */
  pricing?: { type: "hours_tier"; tiers: [number, number][]; extra_hour: number } | null;
}
export const UNIT_LABEL: Record<Addon["unit"], string> = { each: "each", per_day: "per day", flat: "flat" };

export interface Charge {
  id: string;
  kind: ChargeKind;
  addon_id: string | null;
  label: string;
  unit_price: number;
  quantity: number;
  amount: number;
  note: string | null;
  added_by: string | null;
  added_by_staff: boolean;
  auto_key?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  received_at: string;
  receipt_url: string | null;
  note: string | null;
  recorded_by_name: string | null;
  created_at: string;
}

export interface Totals {
  charges: number;
  paid: number;
  balance: number;
}

export interface Billing {
  charges: Charge[];
  payments: Payment[];
  totals: Totals;
  lastReminderAt: string | null;
}

export function totalsOf(charges: { amount: unknown }[], payments: { amount: unknown }[]): Totals {
  const c = money(charges.reduce((s, x) => s + money(x.amount), 0));
  const p = money(payments.reduce((s, x) => s + money(x.amount), 0));
  return { charges: c, paid: p, balance: money(c - p) };
}

/** Everything billed and paid on one booking. `db` must be the service client. */
export async function getBilling(db: SupabaseClient, reservationId: string, withReminders = false): Promise<Billing> {
  const [ch, pay, rem] = await Promise.all([
    db.from("reservation_charges").select("*").eq("reservation_id", reservationId).order("created_at"),
    db.from("reservation_payments").select("*").eq("reservation_id", reservationId).order("received_at").order("created_at"),
    withReminders
      ? db.from("reservation_payment_reminders").select("created_at").eq("reservation_id", reservationId).order("created_at", { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as { created_at: string }[] }),
  ]);
  const charges = ((ch.data ?? []) as Charge[]).map((c) => ({
    ...c, unit_price: money(c.unit_price), quantity: money(c.quantity), amount: money(c.amount),
  }));
  const payments = ((pay.data ?? []) as Payment[]).map((p) => ({ ...p, amount: money(p.amount) }));
  return {
    charges,
    payments,
    totals: totalsOf(charges, payments),
    lastReminderAt: (rem.data?.[0] as { created_at: string } | undefined)?.created_at ?? null,
  };
}

/** Requesters may add or remove their own add-ons until the booking is closed. */
export const requesterCanEditAddons = (status: string | null | undefined) =>
  !isClosedStatus(status) && !["declined", "expired"].includes(status ?? "");

export const firstEventDate = (payload: unknown): string | null => includedDates(payload)[0] ?? null;

/** Keep the old single-payment columns in step (older screens and reports read them). */
export async function syncLegacyPayment(db: SupabaseClient, reservationId: string) {
  const { data } = await db
    .from("reservation_payments")
    .select("amount, method, received_at, receipt_url, recorded_by_name")
    .eq("reservation_id", reservationId)
    .order("received_at", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Payment[];
  const paid = money(rows.reduce((s, r) => s + money(r.amount), 0));
  const last = rows[0];
  await db.from("reservations").update({
    payment_amount: rows.length ? paid : null,
    payment_method: last?.method ?? null,
    payment_received_at: last ? new Date(`${last.received_at}T12:00:00Z`).toISOString() : null,
    payment_receipt_url: last?.receipt_url ?? null,
    payment_recorded_by: last?.recorded_by_name ?? null,
  }).eq("id", reservationId);
}
