import { NextResponse } from "next/server";

const PCO_BASE  = "https://api.planningcenteronline.com";
const TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";

const ALL_TAGS = [
  { type: "Tag", id: "430562" },
  { type: "Tag", id: "70490"  },
  { type: "Tag", id: "248327" },
  { type: "Tag", id: "241212" },
];

async function getAccessToken(): Promise<string | null> {
  const refreshToken = process.env.PCO_REFRESH_TOKEN;
  if (!refreshToken) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      client_id:     process.env.PCO_APP_ID,
      client_secret: process.env.PCO_PAT ?? process.env.PCO_SECRET,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function authHeader(): Promise<string> {
  const at = await getAccessToken();
  if (at) return `Bearer ${at}`;
  const id     = process.env.PCO_APP_ID ?? "";
  const secret = process.env.PCO_PAT ?? process.env.PCO_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function pcoRaw(path: string, method = "GET", body?: unknown) {
  const auth = await authHeader();
  const res = await fetch(`${PCO_BASE}${path}`, {
    method,
    headers: {
      Authorization:  auth,
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

export async function GET() {
  const results: Record<string, unknown> = {};

  // Expose token refresh details
  const refreshToken = process.env.PCO_REFRESH_TOKEN;
  results.has_refresh_token = !!refreshToken;
  results.refresh_token_len = refreshToken?.length ?? 0;
  if (refreshToken) {
    const tr = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     process.env.PCO_APP_ID,
        client_secret: process.env.PCO_PAT ?? process.env.PCO_SECRET,
      }),
    });
    const trText = await tr.text();
    results.token_refresh = { status: tr.status, body: (() => { try { return JSON.parse(trText); } catch { return trText; } })() };
  }

  // Report which auth method is active
  const accessToken = await getAccessToken();
  results.auth_method = accessToken ? "oauth_bearer" : "pat_basic";

  // Test A: create event with all 4 tags (the canonical working payload)
  const a = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug OAuth — DELETE ME", owner_id: parseInt(process.env.PCO_OWNER_ID ?? "20206208", 10) },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.a_create_event = {
    status: a.status,
    id:     a.body?.data?.id,
    owner:  a.body?.data?.relationships?.owner,
    errors: a.body?.errors,
  };

  return NextResponse.json(results);
}
