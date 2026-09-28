import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { type BxRole, can, ROLE_RANK } from "@/lib/roles";

const ASSIGNABLE_ROLES: BxRole[] = ["booking_admin", "ministry_coordinator", "brainerd_staff", "member"];

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: callerRoleRow } = await svc
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const callerRole = (callerRoleRow?.role ?? null) as BxRole | null;
  if (!can.manageUsers(callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, role } = body;
  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }
  if (!ASSIGNABLE_ROLES.includes(role as BxRole)) {
    return NextResponse.json({ error: `Invalid role for invite. Valid: ${ASSIGNABLE_ROLES.join(", ")}` }, { status: 400 });
  }

  // Caller can't assign a role higher than they can assign
  if (callerRole !== "owner" && ROLE_RANK[role as BxRole] >= ROLE_RANK[callerRole!]) {
    return NextResponse.json({ error: "Cannot assign a role equal to or above your own" }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bx.brainerdhq.app";

  // Send magic link invite via Supabase Auth
  const { data: inviteData, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/reservations`,
    data: { bx_role: role }, // stored in user_metadata, picked up by DB trigger or post-confirm hook
  });

  if (inviteErr) {
    console.error("[bx/invite]", inviteErr);
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  }

  // Pre-assign the role in bx_user_roles so it's ready when they confirm
  if (inviteData?.user?.id) {
    await svc.from("bx_user_roles").upsert(
      { user_id: inviteData.user.id, role, assigned_by: user.id, assigned_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }

  return NextResponse.json({ ok: true, email });
}
