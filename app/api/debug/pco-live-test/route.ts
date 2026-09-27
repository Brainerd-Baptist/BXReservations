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
    appIdLength: appId?.length ?? 0,
    hasSecret: !!secret,
  };

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

  // 1. The new correct format: Basic base64(APP_ID:PAT)  ← what lib/pco.ts now does
  if (appId && pat) {
    results.push(await tryAuth("AppId:PAT-Basic", "Basic " + Buffer.from(`${appId}:${pat}`).toString("base64")));
  }

  // 2. Legacy: Basic base64(token:PAT)
  if (pat) {
    results.push(await tryAuth("token:PAT-Basic", "Basic " + Buffer.from(`token:${pat}`).toString("base64")));
  }

  // 3. Bearer PAT
  if (pat) {
    results.push(await tryAuth("Bearer-PAT", `Bearer ${pat}`));
  }

  return NextResponse.json({ credInfo, results });
}
