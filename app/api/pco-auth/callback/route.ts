/**
 * GET /api/pco-auth/callback
 *
 * PCO redirects here after the user authorizes the app. Exchanges the
 * auth code for access + refresh tokens, displays the refresh token so it
 * can be saved as the PCO_REFRESH_TOKEN Vercel environment variable.
 *
 * After saving the env var and redeploying, delete this file and /start.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSysadmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  // C1: the token page is for an Owner or System Admin only.
  const denied = await requireSysadmin();
  if (denied) return denied;
  const code        = req.nextUrl.searchParams.get("code");
  const error       = req.nextUrl.searchParams.get("error");
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app";
  const redirectUri = `${siteUrl}/api/pco-auth/callback`;

  if (error || !code) {
    return NextResponse.json({ error: error ?? "Missing code", hint: "OAuth flow was denied or failed." }, { status: 400 });
  }

  const tokenRes = await fetch("https://api.planningcenteronline.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type:    "authorization_code",
      code,
      client_id:     process.env.PCO_APP_ID,
      client_secret: process.env.PCO_PAT ?? process.env.PCO_SECRET,
      redirect_uri:  redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.refresh_token) {
    return NextResponse.json({ error: "Token exchange failed", details: tokenData }, { status: 500 });
  }

  // Return a page with the refresh token so it can be copied into Vercel env vars.
  const html = `<!DOCTYPE html>
<html>
<head><title>PCO OAuth Success</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px">
  <h1>✅ PCO OAuth Authorized</h1>
  <p>Copy the <strong>Refresh Token</strong> below and save it as <code>PCO_REFRESH_TOKEN</code>
     in your <a href="https://vercel.com/brainerdb/bx-reservations/settings/environment-variables"
     target="_blank">Vercel environment variables</a>, then redeploy.</p>
  <p><strong>Refresh Token:</strong></p>
  <pre style="background:#f4f4f4;padding:12px;border-radius:6px;word-break:break-all;font-size:13px">${tokenData.refresh_token}</pre>
  <p style="color:#666;font-size:14px">Access token expires in ${tokenData.expires_in}s. The refresh token
     doesn't expire as long as it is used at least once every 90 days.</p>
  <hr>
  <p style="color:#888;font-size:12px">After saving the env var and redeploying, delete
     <code>app/api/pco-auth/</code> from the repo — this endpoint has served its purpose.</p>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
