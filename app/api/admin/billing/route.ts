import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { money, firstEventDate } from "@/lib/billing";

export interface BillingRow {
  id: string;
  booking_number: string | null;
  event_name: string | null;
  contact_name: string | null;
  contact_org: string | null;
  contact_email: string | null;
  status: string | null;
  event_date: string | null;
  charges: number;
  paid: number;
  balance: number;
  payments: { amount: number; method: string; received_at: string; receipt_url: string | null }[];
  last_reminder_at: string | null;
}

// GET /api/admin/billing — every booking's total, paid and balance (payment hub)
export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  const db = adminClient();
  const [res, ch, pay, rem] = await Promise.all([
    db.from("reservations").select("id, booking_number, event_name, contact_name, contact_org, contact_email, status, payload").order("created_at", { ascending: false }).limit(1000),
    db.from("reservation_charges").select("reservation_id, amount"),
    db.from("reservation_payments").select("reservation_id, amount, method, received_at, receipt_url").order("received_at"),
    db.from("reservation_payment_reminders").select("reservation_id, created_at").order("created_at", { ascending: false }),
  ]);
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

  const sum = new Map<string, number>();
  for (const c of ch.data ?? []) sum.set(c.reservation_id, money((sum.get(c.reservation_id) ?? 0) + money(c.amount)));
  const pays = new Map<string, BillingRow["payments"]>();
  for (const p of pay.data ?? []) {
    const list = pays.get(p.reservation_id) ?? [];
    list.push({ amount: money(p.amount), method: p.method, received_at: p.received_at, receipt_url: p.receipt_url });
    pays.set(p.reservation_id, list);
  }
  const lastRem = new Map<string, string>();
  for (const r of rem.data ?? []) if (!lastRem.has(r.reservation_id)) lastRem.set(r.reservation_id, r.created_at);

  const rows: BillingRow[] = (res.data ?? []).map((r) => {
    const charges = sum.get(r.id) ?? 0;
    const payments = pays.get(r.id) ?? [];
    const paid = money(payments.reduce((s, p) => s + p.amount, 0));
    return {
      id: r.id, booking_number: r.booking_number, event_name: r.event_name, contact_name: r.contact_name,
      contact_org: r.contact_org, contact_email: r.contact_email, status: r.status,
      event_date: firstEventDate(r.payload), charges, paid, balance: money(charges - paid), payments,
      last_reminder_at: lastRem.get(r.id) ?? null,
    };
  });
  return NextResponse.json(rows);
}
