import { NextRequest, NextResponse } from "next/server";
import { authEmailLink } from "@/lib/auth-links";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { brandedEmailHtml, sendEmail, escHtml } from "@/lib/email";
import { rateLimit, clientIp, HOUR } from "@/lib/rate-limit";

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string; redirectTo?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, password, name, redirectTo } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  const limited = await rateLimit("signup", [
    { key: clientIp(req), max: 20, windowSec: HOUR },
    { key: email, max: 3, windowSec: HOUR },
  ]);
  if (limited) return limited;

  const client = svc();
  if (!client) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bx.brainerdhq.app";
  const finalRedirect = redirectTo ?? `${siteUrl}/auth/callback`;

  // generateLink for signup: creates user (or regenerates link if unconfirmed) without sending Supabase's email
  const { data: linkData, error: linkErr } = await client.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo: finalRedirect,
      data: name ? { full_name: name.trim() } : undefined,
    },
  });

  if (linkErr) {
    const msg = linkErr.message ?? "";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already exists")) {
      return NextResponse.json({ error: "already_exists" }, { status: 409 });
    }
    console.error("[auth/signup] generateLink error:", linkErr);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const confirmUrl = authEmailLink(linkData?.properties, "/reservations", "signup");
  if (!confirmUrl) {
    return NextResponse.json({ error: "Failed to generate confirmation link" }, { status: 500 });
  }

  const firstName = name ? name.trim().split(" ")[0] : null;
  const NAVY = "#00205b";
  const TEAL = "#00abc9";

  const html = brandedEmailHtml({
    preheader: "Confirm your email to activate your BX Reservations account.",
    headline:  "Confirm your email.",
    body: `
      <p style="margin:0 0 16px 0;">Hi${firstName ? ` <strong style="color:${NAVY};">${escHtml(firstName)}</strong>` : ""},</p>
      <p style="margin:0 0 16px 0;">
        Thanks for creating a <strong>BX Reservations</strong> account. Click the button below
        to confirm your email address and activate your account.
      </p>
      <p style="margin:0; color:#6b7280; font-size:13px;">
        If you didn't create an account, you can safely ignore this email.
      </p>`,
    ctaText:     "Confirm Email",
    ctaUrl:      confirmUrl,
    footnoteHtml: `
      <p style="margin:0;">
        Questions? Email
        <a href="mailto:BXreservations@brainerdbaptist.org" style="color:${TEAL}; text-decoration:underline;">BXreservations@brainerdbaptist.org</a>.
      </p>`,
  });

  try {
    await sendEmail({ to: email, subject: "Confirm your BX Reservations account", html });
  } catch (err) {
    console.error("[auth/signup] Resend error:", err);
  }

  return NextResponse.json({ ok: true });
}
