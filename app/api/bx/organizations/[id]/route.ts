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

// ─── GET /api/bx/organizations/[id] ────────────────────────────────────────
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

  const [orgResult, usersResult, reservationsResult, discountsResult] =
    await Promise.all([
      db
        .from("bx_organizations")
        .select("*")
        .eq("id", id)
        .single(),

      db
        .from("bx_org_users")
        .select(
          `org_id, user_id, linked_at, linked_by,
           bx_user_profiles!user_id(display_name, phone, organization)`
        )
        .eq("org_id", id)
        .order("linked_at", { ascending: false }),

      db
        .from("reservations")
        .select(
          `id, booking_number, status, event_name, contact_name, contact_email,
           contact_org, created_at, rack_rate_total, discount_applied, net_amount`
        )
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(25),

      db
        .from("bx_discounts")
        .select("*")
        .eq("org_id", id)
        .is("reservation_id", null)
        .order("created_at", { ascending: false }),
    ]);

  if (orgResult.error) {
    const status = orgResult.error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: orgResult.error.message }, { status });
  }

  const userIds = (usersResult.data ?? []).map((u) => u.user_id);
  let emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: authUsers } = await db.auth.admin.listUsers();
    if (authUsers) {
      emailMap = Object.fromEntries(
        authUsers.users
          .filter((u) => userIds.includes(u.id))
          .map((u) => [u.id, u.email ?? ""])
      );
    }
  }

  const linkedUsers = (usersResult.data ?? []).map((u) => ({
    user_id: u.user_id,
    linked_at: u.linked_at,
    email: emailMap[u.user_id] ?? "",
    display_name:
      (u.bx_user_profiles as { display_name?: string } | null)
        ?.display_name ?? null,
  }));

  return NextResponse.json({
    organization: orgResult.data,
    linked_users: linkedUsers,
    reservations: reservationsResult.data ?? [],
    discounts: discountsResult.data ?? [],
  });
}

// ─── PATCH /api/bx/organizations/[id] ──────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, role } = await getUserAndRole();
  if (!user || !can.viewAdminPanel(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    "name",
    "canonical_name",
    "primary_contact_name",
    "primary_contact_email",
    "phone",
    "address",
    "tier",
    "notes",
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (updates.tier && !["internal", "bbs", "external"].includes(updates.tier as string)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const db = adminClient();
  const { data, error } = await db
    .from("bx_organizations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organization: data });
}
