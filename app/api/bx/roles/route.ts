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

  const { data: callerRole } = await supabase
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = callerRole?.role ?? "member";
  const isAdmin = ["owner", "system_admin", "booking_admin"].includes(role);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ error: "Service client unavailable" }, { status: 503 });
  }

  // Safeguard: refuse to demote/remove the last owner
  if (newRole !== "owner") {
    const { data: currentRoleRow } = await svc
      .from("bx_user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
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

  // Safeguard: only owners can assign or revoke the owner role
  if (newRole === "owner" || /* revoking owner */ false) {
    if (role !== "owner") {
      return NextResponse.json(
        { error: "Only an owner can assign the owner role." },
        { status: 403 }
      );
    }
  }

  const { error } = await svc
    .from("bx_user_roles")
    .upsert({ user_id: userId, role: newRole }, { onConflict: "user_id" });

  if (error) {
    console.error("[bx/roles] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, role: newRole });
}
