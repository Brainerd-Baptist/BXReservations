/**
 * GET /api/pco-auth/start
 *
 * Kick off the PCO OAuth flow. Visit this URL once (as Josiah) to authorize
 * the BX Reservations app. PCO will redirect to /api/pco-auth/callback with
 * an auth code, which is exchanged for access + refresh tokens, then stored
 * in the PCO_REFRESH_TOKEN environment variable on Vercel.
 *
 * This route is intentionally simple and has no CSRF protection — only
 * authorized staff should be visiting it, and it only needs to run once.
 */
export function GET() {
  const clientId   = process.env.PCO_APP_ID ?? "";
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app";
  const redirectUri = `${siteUrl}/api/pco-auth/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         "calendar",
  });

  const authorizeUrl = `https://api.planningcenteronline.com/oauth/authorize?${params}`;
  return Response.redirect(authorizeUrl, 302);
}
