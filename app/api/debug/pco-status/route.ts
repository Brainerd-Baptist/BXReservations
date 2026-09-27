import { NextResponse } from "next/server";

/**
 * GET /api/debug/pco-status
 * Diagnostic: tests PCO Basic-auth credentials. Remove when done debugging.
 */
export async function GET() {
  const appId  = process.env.PCO_APP_ID  ?? "";
  const secret = process.env.PCO_SECRET  ?? "";

  if (!appId || !secret) {
    return NextResponse.json({
      ok: false, stage: "env",
      error: "PCO_APP_ID or PCO_SECRET is empty/missing",
      appIdSet: !!appId, secretSet: !!secret,
    });
  }

  const auth = "Basic " + Buffer.from(`${appId}:${secret}`).toString("base64");
  let res: Response, text: string;

  try {
    res  = await fetch("https://api.planningcenteronline.com/calendar/v2/events?per_page=1", {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
    });
    text = await res.text();
  } catch (err) {
    return NextResponse.json({ ok: false, stage: "fetch", error: String(err) });
  }

  if (!res.ok) {
    return NextResponse.json({
      ok: false, stage: "pco-response",
      status: res.status, body: text.slice(0, 400),
    });
  }

  let meta: unknown;
  try { meta = (JSON.parse(text) as { meta?: unknown }).meta; } catch { meta = null; }

  return NextResponse.json({ ok: true, status: res.status, meta });
}
