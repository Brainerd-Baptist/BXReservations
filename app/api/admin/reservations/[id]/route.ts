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
      id, booking_number, status, organization_id,
      coi_uploaded_at, coi_file_url, coi_expiry_date, coi_accepted_at, coi_accepted_by,
      payment_received_at, payment_amount, payment_method, payment_receipt_url, payment_recorded_by,
      rack_rate_total, discount_applied, net_amount
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

// DELETE /api/admin/reservations/[id]
// Permanently deletes a reservation and all child records. Admin-only.
// Cascade order: comments → history → collaborators → agreements → reservation
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb    = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve the UUID (id may be a booking_number like BX-12345)
  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, booking_number, coi_file_url")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const uuid = res.id;

  // Delete child records in dependency order
  await adminClient().from("reservation_comments").delete().eq("reservation_id", uuid);
  await adminClient().from("reservation_history").delete().eq("reservation_id", uuid);
  await adminClient().from("reservation_collaborators").delete().eq("reservation_id", uuid);
  await adminClient().from("reservation_agreements").delete().eq("reservation_id", uuid);

  // Delete COI file from storage if present
  if (res.coi_file_url) {
    try {
      // Extract the storage path from the public URL: everything after /bx-documents/
      const match = res.coi_file_url.match(/\/bx-documents\/(.+)$/);
      if (match?.[1]) {
        await adminClient().storage.from("bx-documents").remove([match[1]]);
      }
    } catch (err) {
      console.warn("[delete reservation] could not remove COI file:", err);
      // Non-fatal — proceed with row deletion
    }
  }

  // Finally delete the reservation itself
  const { error } = await adminClient().from("reservations").delete().eq("id", uuid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true, id: uuid, booking_number: res.booking_number });
}
