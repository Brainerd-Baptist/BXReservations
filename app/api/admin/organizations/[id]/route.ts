import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── GET — single org with all reservations ─────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  const sb = adminSb();

  const { data: org, error } = await sb
    .from("bx_organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: reservations } = await sb
    .from("reservations")
    .select(
      "id, booking_number, contact_name, contact_email, event_name, status, created_at, " +
      "coi_expiry_date, coi_accepted_at, coi_uploaded_at, payment_received_at, payment_amount, " +
      "payload, cancelled_at"
    )
    .eq("organization_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ organization: org, reservations: reservations ?? [] });
}

// ─── PATCH — update org fields ───────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  const sb = adminSb();
  const body = await req.json();

  const allowed = ["name", "canonical_name", "primary_contact_name", "primary_contact_email", "phone", "notes"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("bx_organizations")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ organization: data });
}

// ─── DELETE — remove org ─────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  const sb = adminSb();

  // Unlink reservations first
  await sb
    .from("reservations")
    .update({ organization_id: null })
    .eq("organization_id", id);

  const { error } = await sb
    .from("bx_organizations")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
