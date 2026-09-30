import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, isStaffRole } from "@/lib/event-map";
import { getBilling, money, syncLegacyPayment } from "@/lib/billing";
import { buildInvoice } from "@/lib/invoice";
import { sendInvoiceEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const db = adminClient();
  const { data: role } = await db.from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  const { data: prof } = await db.from("bx_user_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  return { user, db, name: (prof?.display_name as string | undefined) ?? user.email ?? "Admin" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function findReservation(db: ReturnType<typeof adminClient>, id: string) {
  const q = db.from("reservations").select("id, booking_number");
  const { data } = await (UUID.test(id) ? q.eq("id", id) : q.eq("booking_number", id)).maybeSingle();
  return data as { id: string; booking_number: string | null } | null;
}

// POST /api/admin/reservations/[id]/payment — record one payment (deposits,
// partials and final payments each get their own row)
// body: { amount | payment_amount, method | payment_method, received_at?, receipt_url?, note? }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const actor = await requireAdmin();
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const { db } = actor;

  const body = await req.json().catch(() => ({}));
  const amount = money(body.amount ?? body.payment_amount);
  const method = String(body.method ?? body.payment_method ?? "").trim();
  const receivedRaw = String(body.received_at ?? body.payment_received_at ?? "").slice(0, 10);
  const receivedAt = /^\d{4}-\d{2}-\d{2}$/.test(receivedRaw) ? receivedRaw : new Date().toISOString().slice(0, 10);
  const receiptUrl = String(body.receipt_url ?? body.payment_receipt_url ?? "").trim();
  const note = String(body.note ?? "").trim().slice(0, 300);

  if (!(amount > 0)) return NextResponse.json({ error: "Enter an amount greater than $0." }, { status: 400 });
  if (!method) return NextResponse.json({ error: "Choose how it was paid." }, { status: 400 });
  if (receiptUrl && !/^https?:\/\//i.test(receiptUrl)) return NextResponse.json({ error: "Receipt link must start with https://" }, { status: 400 });

  const res = await findReservation(db, id);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await db.from("reservation_payments").insert({
    reservation_id: res.id, amount, method: method.slice(0, 40), received_at: receivedAt,
    receipt_url: receiptUrl || null, note: note || null,
    recorded_by: actor.user.id, recorded_by_name: actor.name,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncLegacyPayment(db, res.id);

  await db.from("reservation_history").insert({
    reservation_id: res.id, actor_id: actor.user.id, actor_name: actor.name, actor_role: "admin",
    action: "payment_recorded",
    note: `Payment of $${amount.toFixed(2)} recorded via ${method}.`,
    metadata: { payment_amount: amount, payment_method: method, payment_receipt_url: receiptUrl || null },
  });
  // Optional: email a receipt (itemized PDF attached)
  let emailed: boolean | null = null;
  if (body.send_receipt) {
    emailed = false;
    try {
      const inv = await buildInvoice(db, res.id);
      const r = inv?.reservation;
      if (inv && r?.contact_email) {
        await sendInvoiceEmail({
          to: r.contact_email, name: r.contact_name || r.contact_email, bookingNumber: r.booking_number ?? r.id.slice(0, 8),
          reservationId: r.id, eventName: r.event_name || "your event", kind: inv.paid ? "receipt" : "invoice",
          totals: inv.billing.totals, justPaid: { amount, method }, pdf: inv.bytes, filename: inv.filename,
        });
        emailed = true;
      }
    } catch (e) { console.error("[payment] receipt email failed:", e); }
  }
  return NextResponse.json({ ok: true, emailed, billing: await getBilling(db, res.id, true) });
}

// DELETE ?paymentId= — remove a payment recorded by mistake
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const actor = await requireAdmin();
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const { db } = actor;
  const res = await findReservation(db, id);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  const { data: p } = await db.from("reservation_payments").select("amount, method").eq("id", paymentId ?? "").eq("reservation_id", res.id).maybeSingle();
  if (!p) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  await db.from("reservation_payments").delete().eq("id", paymentId!);
  await syncLegacyPayment(db, res.id);
  await db.from("reservation_history").insert({
    reservation_id: res.id, actor_id: actor.user.id, actor_name: actor.name, actor_role: "admin",
    action: "payment_removed", note: `Payment of $${money(p.amount).toFixed(2)} (${p.method}) removed.`,
  });
  return NextResponse.json({ ok: true, billing: await getBilling(db, res.id, true) });
}
