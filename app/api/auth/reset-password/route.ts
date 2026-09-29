import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { brandedEmailHtml, sendEmail } from "@/lib/email";

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(req: NextRequest) {
  let body: { email?: string; redirectTo?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, redirectTo } = body;
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const client = svc();
  if (!client) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bx.brainerdhq.app";
  const finalRedirect = redirectTo ?? `${siteUrl}/auth/callback?next=/auth/reset-password`;

  // Generate recovery link without sending Supabase's generic email
  const { data: linkData, error: linkErr } = await client.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: finalRedirect },
  });

  // Always return 200 to prevent email enumeration
  if (linkErr || !linkData?.properties?.action_link) {
    console.warn("[auth/reset-password] generateLink issue:", linkErr?.message);
    return NextResponse.json({ ok: true });
  }

  const NAVY = "#00205b";
  const TEAL = "#00abc9";

  const html = brandedEmailHtml({
    preheader: "We received a request to reset your BX Reservations password.",
    headline:  "Reset your password.",
    body: `
      <p style="margin:0 0 16px 0;">We received a request to reset the password for your <strong>BX Reservations</strong> account.</p>
      <p style="margin:0 0 16px 0;">Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:0; color:#6b7280; font-size:13px;">
        If you didn't request a password reset, you can safely ignore this email — your account hasn't been changed.
      </p>`,
    ctaText:     "Reset Password",
    ctaUrl:      linkData.properties.action_link,
    footnoteHtml: `
      <p style="margin:0;">
        Questions? Email
        <a href="mailto:BXreservations@brainerdbaptist.org" style="color:${TEAL}; text-decoration:underline;">BXreservations@brainerdbaptist.org</a>
        or call <a href="tel:4236434978" style="color:${TEAL}; text-decoration:underline;">(423) 643-4978</a>.
      </p>`,
  });

  try {
    await sendEmail({ to: email, subject: "Reset your BX Reservations password", html });
  } catch (err) {
    console.error("[auth/reset-password] Resend error:", err);
  }

  return NextResponse.json({ ok: true });
}
