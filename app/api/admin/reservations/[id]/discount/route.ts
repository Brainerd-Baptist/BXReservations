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
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(ts) { try { ts.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
}

async function requireAdmin(sb: Awaited<ReturnType<typeof sbServer>>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient().from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

// POST /api/admin/reservations/[id]/discount
// Creates a per-booking bx_discounts entry
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, organization_id")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { type, value, scope, room_id, discount_reason, note } = body;

  if (!["percent", "flat_dollar", "room_rate_override"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (typeof value !== "number" || value <= 0) {
    return NextResponse.json({ error: "Value must be a positive number" }, { status: 400 });
  }
  const resolvedScope = scope ?? "all_rooms";
  if (!["all_rooms", "specific_room"].includes(resolvedScope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const { data, error } = await adminClient()
    .from("bx_discounts")
    .insert({
      org_id: res.organization_id ?? null,
      reservation_id: res.id,
      type,
      value,
      scope: resolvedScope,
      room_id: resolvedScope === "specific_room" ? (room_id ?? null) : null,
      discount_reason: discount_reason ?? null,
      note: note ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discount: data }, { status: 201 });
}

// GET /api/admin/reservations/[id]/discount
// Lists per-booking discount entries for this reservation
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: res } = await adminClient()
    .from("reservations")
    .select("id")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await adminClient()
    .from("bx_discounts")
    .select("id, type, value, scope, room_id, discount_reason, note, created_at")
    .eq("reservation_id", res.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discounts: data ?? [] });
}

// DELETE /api/admin/reservations/[id]/discount
// Removes a per-booking discount entry. Body: { discountId }
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { discountId } = body;
  if (!discountId) return NextResponse.json({ error: "discountId required" }, { status: 400 });

  const { data: res } = await adminClient()
    .from("reservations")
    .select("id")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await adminClient()
    .from("bx_discounts")
    .delete()
    .eq("id", discountId)
    .eq("reservation_id", res.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
