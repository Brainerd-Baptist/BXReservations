import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";
import { normalizeOrgName, canonicalOrgName } from "@/lib/org-name";

// ─── Admin service-role client ──────────────────────────────────────────────
function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// ─── GET /api/bx/organizations ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user, role } = await getUserAndRole();
  if (!user || !can.viewAdminPanel(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const search = sp.get("search") ?? "";
  const tier = sp.get("tier") ?? "";

  const db = adminClient();

  let query = db
    .from("bx_organizations")
    .select(
      `id, name, canonical_name, primary_contact_name, primary_contact_email,
       phone, address, tier, notes, created_at, updated_at,
       bx_org_users(user_id),
       reservations!organization_id(id, status)`
    )
    .order("name");

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,canonical_name.ilike.%${search}%,primary_contact_name.ilike.%${search}%`
    );
  }
  if (tier && ["internal", "bbs", "external"].includes(tier)) {
    query = query.eq("tier", tier);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const organizations = (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    canonical_name: o.canonical_name,
    primary_contact_name: o.primary_contact_name,
    primary_contact_email: o.primary_contact_email,
    phone: o.phone,
    address: o.address,
    tier: o.tier,
    notes: o.notes,
    created_at: o.created_at,
    updated_at: o.updated_at,
    user_count: (o.bx_org_users as unknown[])?.length ?? 0,
    reservation_count: (o.reservations as unknown[])?.length ?? 0,
  }));

  return NextResponse.json({ organizations });
}

// ─── POST /api/bx/organizations ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { user, role } = await getUserAndRole();
  if (!user || !can.viewAdminPanel(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    canonical_name,
    primary_contact_name,
    primary_contact_email,
    phone,
    address,
    tier,
    notes,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!["internal", "bbs", "external"].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const db = adminClient();
  const normalizedName = normalizeOrgName(name.trim());
  const { data, error } = await db
    .from("bx_organizations")
    .insert({
      name: normalizedName,
      canonical_name: canonicalOrgName(canonical_name ?? name),
      primary_contact_name: primary_contact_name ?? null,
      primary_contact_email: primary_contact_email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      tier: tier ?? "external",
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organization: data }, { status: 201 });
}
