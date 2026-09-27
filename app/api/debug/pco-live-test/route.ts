import { NextResponse } from "next/server";

/**
 * GET /api/debug/pco-live-test
 * Raw PCO auth test — returns full PCO response so we can see the exact error.
 * REMOVE after debugging.
 */
export async function GET() {
  const pat = process.env.PCO_PAT;
  const appId = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;

  // Report which creds are present (not values)
  const credInfo = {
    hasPAT: !!pat,
    patLength: pat?.length ?? 0,
    patPrefix: pat?.slice(0, 12) ?? "none",
    hasAppId: !!appId,
    hasSecret: !!secret,
  };

  // Try PAT as Basic auth: token:<pat>
  const authBasicPAT = pat
    ? "Basic " + Buffer.from(`token:${pat}`).toString("base64")
    : null;

  // Try App ID + Secret Basic auth
  const authBasicApp = appId && secret
    ? "Basic " + Buffer.from(`${appId}:${secret}`).toString("base64")
    : null;

  async function tryAuth(label: string, authHeader: string) {
    const res = await fetch("https://api.planningcenteronline.com/calendar/v2/events", {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep raw */ }
    return { label, status: res.status, ok: res.ok, body };
  }

  const results = [];
  if (authBasicPAT) results.push(await tryAuth("PAT-Basic", authBasicPAT));
  if (authBasicApp) results.push(await tryAuth("AppSecret-Basic", authBasicApp));

  return NextResponse.json({ credInfo, results });
}
