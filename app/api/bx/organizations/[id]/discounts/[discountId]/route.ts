import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndRole } from "@/lib/get-user-role";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

type Params = { params: Promise<{ id: string; discountId: string }> };

// ─── PATCH /api/bx/organizations/[id]/discounts/[discountId] ───────────────
export async function PATCH(
  request: NextRequest,
  { params }: Params
) {
  const { user, role } = await getUserAndRole();
  if (!user || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, discountId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = adminClient();

  // Verify the discount belongs to this org
  const { data: existing } = await db
    .from("bx_discounts")
    .select("id, org_id")
    .eq("id", discountId)
    .eq("org_id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }

  const VALID_TYPES = ["percent", "flat_dollar", "room_rate_override"];
  const VALID_SCOPES = ["all_rooms", "specific_room"];
  const VALID_REASONS = ["bbs_default", "bx_ministry_initiative", "nonprofit_partner", "staff_courtesy", "other"];

  const updates: Record<string, unknown> = {};
  if ("type" in body) {
    if (!VALID_TYPES.includes(body.type as string)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    updates.type = body.type;
  }
  if ("value" in body) {
    if (typeof body.value !== "number" || (body.value as number) < 0) {
      return NextResponse.json({ error: "value must be non-negative" }, { status: 400 });
    }
    updates.value = body.value;
  }
  if ("scope" in body) {
    if (!VALID_SCOPES.includes(body.scope as string)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    updates.scope = body.scope;
  }
  if ("room_id" in body) updates.room_id = body.room_id ?? null;
  if ("discount_reason" in body) {
    if (body.discount_reason && !VALID_REASONS.includes(body.discount_reason as string)) {
      return NextResponse.json({ error: "Invalid discount_reason" }, { status: 400 });
    }
    updates.discount_reason = body.discount_reason ?? null;
  }
  if ("note" in body) updates.note = (body.note as string)?.trim() ?? null;

  const { data, error } = await db
    .from("bx_discounts")
    .update(updates)
    .eq("id", discountId)
    .eq("org_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discount: data });
}

// ─── DELETE /api/bx/organizations/[id]/discounts/[discountId] ─────────────
export async function DELETE(
  _request: NextRequest,
  { params }: Params
) {
  const { user, role } = await getUserAndRole();
  if (!user || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, discountId } = await params;
  const db = adminClient();

  const { error } = await db
    .from("bx_discounts")
    .delete()
    .eq("id", discountId)
    .eq("org_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
