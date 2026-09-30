import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: caller, role: callerRole } = await getUserAndRole();
  if (!caller || !can.deleteUser(callerRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: targetUserId } = await params;

  // Prevent self-deletion
  if (caller.id === targetUserId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const client = adminClient();

  // Fetch target role — never delete another owner
  const { data: roleRow } = await client
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", targetUserId)
    .single();

  if (roleRow?.role === "owner") {
    return NextResponse.json({ error: "Cannot delete the owner account" }, { status: 403 });
  }
  // Only the Owner may remove a System Admin (matches who may change their role).
  if (roleRow?.role === "system_admin" && callerRole !== "owner") {
    return NextResponse.json({ error: "Only the Owner can remove a System Admin" }, { status: 403 });
  }

  // Delete from Supabase Auth — cascades to bx_user_roles + bx_user_profiles via trigger
  const { error: deleteErr } = await client.auth.admin.deleteUser(targetUserId);
  if (deleteErr) {
    console.error("[admin/users/delete]", deleteErr.message);
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
