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

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/bx/organizations/[id]/discounts ──────────────────────────────
// Returns org-level discount rules (reservation_id IS NULL)
export async function GET(
  _request: NextRequest,
  { params }: Params
) {
  const { user, role } = await getUserAndRole();
  if (!user || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = adminClient();

  const { data, error } = await db
    .from("bx_discounts")
    .select("id, org_id, type, value, scope, room_id, discount_reason, note, created_at")
    .eq("org_id", id)
    .is("reservation_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discounts: data ?? [] });
}

// ─── POST /api/bx/organizations/[id]/discounts ─────────────────────────────
// Creates a new org-level discount rule
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  const { user, role } = await getUserAndRole();
  if (!user || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: {
    type?: string;
    value?: number;
    scope?: string;
    room_id?: string | null;
    discount_reason?: string;
    note?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, value, scope, room_id, discount_reason, note } = body;

  if (!["percent", "flat_dollar", "room_rate_override"].includes(type ?? "")) {
    return NextResponse.json({ error: "Invalid discount type" }, { status: 400 });
  }
  if (typeof value !== "number" || value < 0) {
    return NextResponse.json({ error: "value must be a non-negative number" }, { status: 400 });
  }
  if (!["all_rooms", "specific_room"].includes(scope ?? "")) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (scope === "specific_room" && !room_id) {
    return NextResponse.json({ error: "room_id required for specific_room scope" }, { status: 400 });
  }

  const VALID_REASONS = ["bbs_default", "bx_ministry_initiative", "nonprofit_partner", "staff_courtesy", "other"];
  if (discount_reason && !VALID_REASONS.includes(discount_reason)) {
    return NextResponse.json({ error: "Invalid discount_reason" }, { status: 400 });
  }

  const db = adminClient();

  const { data, error } = await db
    .from("bx_discounts")
    .insert({
      org_id: id,
      reservation_id: null,
      type,
      value,
      scope,
      room_id: scope === "specific_room" ? (room_id ?? null) : null,
      discount_reason: discount_reason ?? null,
      note: note?.trim() ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discount: data }, { status: 201 });
}
