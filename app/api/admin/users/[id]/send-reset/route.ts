import { NextRequest, NextResponse } from "next/server";
import { authEmailLink } from "@/lib/auth-links";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";
import { brandedEmailHtml, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: caller, role: callerRole } = await getUserAndRole();
  if (!caller || !can.manageUsers(callerRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: targetUserId } = await params;
  const client = adminClient();

  const { data: userData, error: userError } = await client.auth.admin.getUserById(targetUserId);
  if (userError || !userData?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const targetEmail = userData.user.email;
  const siteUrl = SITE_URL;
  const redirectTo = `${siteUrl}/auth/callback?next=/auth/reset-password`;

  // Generate recovery link without sending Supabase's generic email
  const { data: linkData, error: linkErr } = await client.auth.admin.generateLink({
    type: "recovery",
    email: targetEmail,
    options: { redirectTo },
  });

  const resetUrl = authEmailLink(linkData?.properties, "/auth/reset-password", "recovery");
  if (linkErr || !resetUrl) {
    console.error("[send-reset] generateLink error:", linkErr?.message);
    return NextResponse.json({ error: linkErr?.message ?? "Failed to generate link" }, { status: 500 });
  }

  const NAVY = "#00205b";
  const TEAL = "#00abc9";

  const html = brandedEmailHtml({
    preheader: "Your BX Reservations password reset link is ready.",
    headline:  "Reset your password.",
    body: `
      <p style="margin:0 0 16px 0;">An administrator has sent you a link to reset your <strong>BX Reservations</strong> password.</p>
      <p style="margin:0 0 16px 0;">Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:0; color:#6b7280; font-size:13px;">
        If you weren't expecting this, contact the church office — your account has not been changed.
      </p>`,
    ctaText:     "Reset Password",
    ctaUrl:      resetUrl,
    footnoteHtml: `
      <p style="margin:0;">
        Questions? Email
        <a href="mailto:BXreservations@brainerdbaptist.org" style="color:${TEAL}; text-decoration:underline;">BXreservations@brainerdbaptist.org</a>
        or call <a href="tel:4236434978" style="color:${TEAL}; text-decoration:underline;">(423) 643-4978</a>.
      </p>`,
  });

  try {
    await sendEmail({ to: targetEmail, subject: "Reset your BX Reservations password", html });
  } catch (err) {
    console.error("[send-reset] Resend error:", err);
    return NextResponse.json({ error: "Email delivery failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
