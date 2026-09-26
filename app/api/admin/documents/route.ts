import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { adminClient, isStaffRole } from "@/lib/event-map";

function sbServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(ts) { try { ts.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} } } }
  );
}

async function requireAdmin() {
  const sb = sbServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient.from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

// GET /api/admin/documents?type=agreements|cois|payments
export async function GET(req: NextRequest) {
  const actor = await requireAdmin();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");
  if (!type || !["agreements", "cois", "payments"].includes(type)) {
    return NextResponse.json({ error: "type must be agreements | cois | payments" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (type === "agreements") {
    const { data, error } = await supabase
      .from("reservation_agreements")
      .select("reservation_id, customer_signed_at, pdf_url, reservations(booking_number, contact_name, contact_org, event_name, payload)")
      .not("customer_signed_at", "is", null)
      .order("customer_signed_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []).map((row: any) => {
      const res = row.reservations ?? {};
      const payload = (res.payload ?? {}) as Record<string, unknown>;
      const days = (payload.days as Record<string, unknown>[]) ?? [];
      const firstDay = (days[0] ?? {}) as Record<string, unknown>;
      return {
        reservation_id:     row.reservation_id as string,
        booking_number:     (res.booking_number as string) ?? "",
        contact_name:       (res.contact_name  as string) ?? "",
        contact_org:        (res.contact_org   as string) ?? "",
        event_name:         (res.event_name    as string) ?? "",
        event_date:         (firstDay.date     as string) ?? "",
        customer_signed_at: row.customer_signed_at as string,
        pdf_url:            row.pdf_url as string | null,
      };
    });

    return NextResponse.json(rows);
  }

  if (type === "cois") {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, booking_number, contact_name, contact_org, event_name, coi_uploaded_at, coi_accepted_at, coi_expiry_date, coi_file_url")
      .not("coi_uploaded_at", "is", null)
      .order("coi_expiry_date", { ascending: true, nullsFirst: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []).map((row: any) => ({
      reservation_id:  row.id as string,
      booking_number:  row.booking_number as string,
      contact_name:    (row.contact_name  as string) ?? "",
      contact_org:     (row.contact_org   as string) ?? "",
      event_name:      (row.event_name    as string) ?? "",
      coi_uploaded_at: row.coi_uploaded_at as string,
      coi_accepted_at: row.coi_accepted_at as string | null,
      coi_expiry_date: row.coi_expiry_date as string | null,
      coi_file_url:    row.coi_file_url   as string | null,
    }));

    return NextResponse.json(rows);
  }

  // payments
  const { data, error } = await supabase
    .from("reservations")
    .select("id, booking_number, contact_name, contact_org, event_name, payment_received_at, payment_amount, payment_method, payment_receipt_url")
    .not("payment_received_at", "is", null)
    .order("payment_received_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((row: any) => ({
    reservation_id:      row.id as string,
    booking_number:      row.booking_number as string,
    contact_name:        (row.contact_name       as string) ?? "",
    contact_org:         (row.contact_org        as string) ?? "",
    event_name:          (row.event_name         as string) ?? "",
    payment_received_at: row.payment_received_at as string,
    payment_amount:      (row.payment_amount      as number) ?? 0,
    payment_method:      (row.payment_method      as string) ?? "",
    payment_receipt_url: row.payment_receipt_url as string | null,
  }));

  return NextResponse.json(rows);
}
