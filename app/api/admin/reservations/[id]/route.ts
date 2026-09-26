import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient, isStaffRole } from "@/lib/event-map";

type Params = { params: Promise<{ id: string }> };

async function sbServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(ts) { try { ts.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } catch {} } } }
  );
}

async function requireAdmin(sb: Awaited<ReturnType<typeof sbServer>>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient().from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

// GET /api/admin/reservations/[id]
// Returns full document/payment status for the admin panel
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb    = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: res } = await adminClient()
    .from("reservations")
    .select(`
      id, booking_number, status,
      coi_uploaded_at, coi_file_url, coi_expiry_date, coi_accepted_at, coi_accepted_by,
      payment_received_at, payment_amount, payment_method, payment_receipt_url, payment_recorded_by
    `)
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch latest agreement
  const { data: agreement } = await adminClient()
    .from("reservation_agreements")
    .select("id, token, customer_signed_at, customer_name, sent_at, pdf_url")
    .eq("reservation_id", res.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ reservation: res, agreement: agreement ?? null });
}
