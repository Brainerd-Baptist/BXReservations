import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// ─── GET /api/bx/users/[id] ─────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, role } = await getUserAndRole();
  if (!user || !can.viewAdminPanel(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = adminClient();

  const { data: authUser, error: authErr } = await db.auth.admin.getUserById(id);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [profileResult, roleResult, reservationsResult, orgsResult] = await Promise.all([
    db.from("bx_user_profiles").select("*").eq("user_id", id).maybeSingle(),
    db.from("bx_user_roles").select("role, assigned_at").eq("user_id", id).maybeSingle(),
    db
      .from("reservations")
      .select("id, booking_number, status, event_name, contact_name, created_at, rack_rate_total, net_amount")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    db
      .from("bx_org_users")
      .select("org_id, linked_at, bx_organizations!org_id(id, name, tier)")
      .eq("user_id", id)
      .order("linked_at", { ascending: false }),
  ]);

  return NextResponse.json({
    auth_user: {
      id: authUser.user.id,
      email: authUser.user.email ?? "",
      created_at: authUser.user.created_at,
      last_sign_in_at: authUser.user.last_sign_in_at ?? null,
      email_confirmed_at: authUser.user.email_confirmed_at ?? null,
    },
    profile: profileResult.data ?? null,
    role: roleResult.data?.role ?? null,
    reservations: reservationsResult.data ?? [],
    linked_orgs: (orgsResult.data ?? []).map((o) => ({
      org_id: o.org_id,
      linked_at: o.linked_at,
      name: (o.bx_organizations as { name?: string } | null)?.name ?? "",
      tier: (o.bx_organizations as { tier?: string } | null)?.tier ?? "external",
    })),
  });
}

// ─── PATCH /api/bx/users/[id] ────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, role } = await getUserAndRole();
  if (!user || !can.manageUsers(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowed = ["display_name", "phone", "organization"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of allowed) {
    if (f in body) updates[f] = body[f] ?? null;
  }

  const db = adminClient();
  const { data, error } = await db
    .from("bx_user_profiles")
    .upsert({ user_id: id, ...updates }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
