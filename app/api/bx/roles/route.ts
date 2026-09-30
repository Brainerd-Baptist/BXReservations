import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const VALID_ROLES = ["member", "brainerd_staff", "ministry_coordinator", "booking_admin", "system_admin", "owner"];

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(req: NextRequest) {
  // Verify caller is an admin
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the caller's role with the service key: the roles table's own
  // row-level rules are for the browser, not for this server check.
  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ error: "Service client unavailable" }, { status: 503 });
  }
  const { data: callerRole } = await svc
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = callerRole?.role ?? "member";
  // Only Owners and System Admins manage roles.
  if (role !== "owner" && role !== "system_admin") {
    return NextResponse.json({ error: "Only an Owner or System Admin can change roles." }, { status: 403 });
  }

  let body: { userId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, role: newRole } = body;
  if (!userId || !newRole) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(newRole)) {
    return NextResponse.json({ error: `Invalid role. Valid: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  // Safeguard: refuse to demote/remove the last owner
  if (newRole !== "owner") {
    const { data: currentRoleRow } = await svc
      .from("bx_user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (currentRoleRow?.role === "owner") {
      const { count } = await svc
        .from("bx_user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "owner");
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last owner. Promote another user to owner first." },
          { status: 409 }
        );
      }
    }
  }

  // Safeguard: only an Owner can grant Owner or System Admin, or change
  // someone who already holds either.
  if (role !== "owner") {
    const { data: targetRow } = await svc
      .from("bx_user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const target = targetRow?.role;
    if (newRole === "owner" || newRole === "system_admin" || target === "owner" || target === "system_admin") {
      return NextResponse.json(
        { error: "Only an Owner can assign or change Owner and System Admin roles." },
        { status: 403 }
      );
    }
  }

  // The roles table stores the email too (required), so look it up — a user
  // who has never had a role has no row yet.
  const { data: target, error: targetErr } = await svc.auth.admin.getUserById(userId);
  if (targetErr || !target?.user?.email) {
    return NextResponse.json({ error: "That user wasn't found." }, { status: 404 });
  }
  const { error } = await svc
    .from("bx_user_roles")
    .upsert({ user_id: userId, email: target.user.email, role: newRole }, { onConflict: "user_id" });

  if (error) {
    console.error("[bx/roles] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, role: newRole });
}
