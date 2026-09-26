import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient, isStaffRole } from "@/lib/event-map";

type Params = { params: Promise<{ id: string }> };

function sbServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(ts) { try { ts.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } catch {} } } }
  );
}

async function requireAdmin(sb: ReturnType<typeof sbServer>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient.from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

// POST /api/admin/reservations/[id]/payment
// body: { payment_amount, payment_method, payment_received_at?, payment_receipt_url? }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb    = sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const amount:     number = parseFloat(body.payment_amount ?? "0");
  const method:     string = (body.payment_method ?? "").trim();
  const receivedAt: string = body.payment_received_at ?? new Date().toISOString();
  const receiptUrl: string = (body.payment_receipt_url ?? "").trim();

  if (!amount || amount <= 0) return NextResponse.json({ error: "payment_amount must be a positive number." }, { status: 400 });
  if (!method) return NextResponse.json({ error: "payment_method is required." }, { status: 400 });

  const { data: res } = await adminClient
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: profile } = await adminClient.from("bx_user_profiles").select("display_name").eq("user_id", actor.user.id).maybeSingle();
  const actorName = profile?.display_name ?? actor.user.email ?? "Admin";

  await adminClient.from("reservations").update({
    payment_received_at: receivedAt,
    payment_amount:      amount,
    payment_method:      method,
    payment_receipt_url: receiptUrl || null,
    payment_recorded_by: actorName,
  }).eq("id", res.id);

  await adminClient.from("reservation_history").insert({
    reservation_id: res.id,
    actor_id:       actor.user.id,
    actor_name:     actorName,
    actor_role:     "admin",
    action:         "payment_recorded",
    note:           `Payment of $${amount.toFixed(2)} recorded via ${method}.`,
    metadata: {
      payment_amount:  amount,
      payment_method:  method,
      payment_receipt_url: receiptUrl || null,
    },
  });

  return NextResponse.json({ ok: true });
}
