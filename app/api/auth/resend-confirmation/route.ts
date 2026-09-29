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
  const finalRedirect = redirectTo ?? `${siteUrl}/auth/callback`;

  // Use a magic link to confirm + log in the user without touching their password
  const { data: linkData, error: linkErr } = await client.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: finalRedirect },
  });

  // Always return 200 to prevent enumeration
  if (linkErr || !linkData?.properties?.action_link) {
    console.warn("[resend-confirmation] generateLink issue:", linkErr?.message);
    return NextResponse.json({ ok: true });
  }

  const TEAL = "#00abc9";
  const NAVY = "#00205b";

  const html = brandedEmailHtml({
    preheader: "Here's your confirmation link for BX Reservations.",
    headline:  "Confirm your email.",
    body: `
      <p style="margin:0 0 16px 0;">Click the button below to confirm your email address and activate your <strong>BX Reservations</strong> account.</p>
      <p style="margin:0; color:#6b7280; font-size:13px;">
        If you didn't create an account, you can safely ignore this email.
      </p>`,
    ctaText:     "Confirm Email",
    ctaUrl:      linkData.properties.action_link,
    footnoteHtml: `
      <p style="margin:0;">
        Questions? Email
        <a href="mailto:BXreservations@brainerdbaptist.org" style="color:${TEAL}; text-decoration:underline;">BXreservations@brainerdbaptist.org</a>.
      </p>`,
  });

  try {
    await sendEmail({ to: email, subject: "Confirm your BX Reservations account", html });
  } catch (err) {
    console.error("[resend-confirmation] Resend error:", err);
  }

  return NextResponse.json({ ok: true });
}
