import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify caller has admin access
  const { user: caller, role: callerRole } = await getUserAndRole();
  if (!caller || !can.manageUsers(callerRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: targetUserId } = await params;

  // 2. Look up the target user's email via service-role client
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(targetUserId);
  if (userError || !userData?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const targetEmail = userData.user.email;

  // 3. Send the reset email — route through /auth/callback so PKCE code exchange happens
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const redirectTo = `${siteUrl}/auth/callback?next=/auth/reset-password`;

  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(targetEmail, {
    redirectTo,
  });

  if (resetError) {
    console.error("[send-reset] resetPasswordForEmail error:", resetError.message);
    return NextResponse.json({ error: resetError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
