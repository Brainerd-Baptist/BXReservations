import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient } from "@/lib/event-map";
import { buildInvoice } from "@/lib/invoice";
import { sendInvoiceEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// POST — email the organizer the invoice (or receipt, when paid) with the PDF attached
export async function POST(_req: NextRequest, { params }: Params) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  const db = adminClient();
  const inv = await buildInvoice(db, id);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = inv.reservation;
  if (!r.contact_email) return NextResponse.json({ error: "This booking has no contact email." }, { status: 400 });
  if (!inv.billing.charges.length) return NextResponse.json({ error: "Add charges before sending an invoice." }, { status: 400 });
  try {
    await sendInvoiceEmail({
      to: r.contact_email, name: r.contact_name || r.contact_email, bookingNumber: r.booking_number ?? r.id.slice(0, 8),
      reservationId: r.id, eventName: r.event_name || "your event", kind: inv.paid ? "receipt" : "invoice",
      totals: inv.billing.totals, pdf: inv.bytes, filename: inv.filename,
    });
  } catch (e) {
    return NextResponse.json({ error: `Couldn't send: ${(e as Error).message}` }, { status: 502 });
  }
  const { user } = await getUserAndRole();
  await db.from("reservation_history").insert({
    reservation_id: r.id, actor_id: user?.id ?? null, actor_role: "admin", action: inv.paid ? "receipt_sent" : "invoice_sent",
    note: `${inv.paid ? "Receipt" : "Invoice"} emailed to ${r.contact_email}.`,
  });
  return NextResponse.json({ ok: true, kind: inv.paid ? "receipt" : "invoice" });
}
