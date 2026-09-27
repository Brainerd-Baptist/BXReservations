import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { type BxRole, can, ROLE_RANK } from "@/lib/roles";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Verify caller has admin access
  const { data: callerRoleRow } = await svc
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const callerRole = (callerRoleRow?.role ?? null) as BxRole | null;
  if (!can.manageUsers(callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all auth users via admin API (service role)
  const { data: authData, error: listErr } = await svc.auth.admin.listUsers({ perPage: 500 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const authUsers = authData.users ?? [];
  const userIds = authUsers.map((u) => u.id);

  // Fetch roles
  const { data: roles } = await svc
    .from("bx_user_roles")
    .select("user_id, role")
    .in("user_id", userIds);

  // Fetch profiles
  const { data: profiles } = await svc
    .from("bx_user_profiles")
    .select("user_id, display_name, organization")
    .in("user_id", userIds);

  // Fetch reservation counts
  const { data: resCounts } = await svc
    .from("reservations")
    .select("owner_id")
    .in("owner_id", userIds);

  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.user_id, r.role as BxRole]));
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
  const countMap: Record<string, number> = {};
  (resCounts ?? []).forEach((r) => {
    if (r.owner_id) countMap[r.owner_id] = (countMap[r.owner_id] ?? 0) + 1;
  });

  const users = authUsers.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    display_name: profileMap[u.id]?.display_name ?? null,
    organization: profileMap[u.id]?.organization ?? null,
    role: roleMap[u.id] ?? null,
    reservation_count: countMap[u.id] ?? 0,
    last_active: u.last_sign_in_at ?? null,
  }));

  // Sort: owners + system_admins first, then by last active
  users.sort((a, b) => {
    const ra = a.role ? ROLE_RANK[a.role] : 0;
    const rb = b.role ? ROLE_RANK[b.role] : 0;
    if (ra !== rb) return rb - ra;
    return (b.last_active ?? "").localeCompare(a.last_active ?? "");
  });

  return NextResponse.json({ users, callerRole });
}
