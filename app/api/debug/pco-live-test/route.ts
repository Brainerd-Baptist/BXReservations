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

  // Test A: create event with no owner field (let PCO auto-assign from OAuth session)
  const a = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug No-Owner — DELETE ME" },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.a_no_owner = {
    status: a.status,
    id:     a.body?.data?.id,
    owner:  a.body?.data?.relationships?.owner,
    errors: a.body?.errors,
  };

  // Test B: create event with owner as relationship
  const b = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug Owner-Rel — DELETE ME" },
      relationships: {
        owner: { data: { type: "Person", id: process.env.PCO_OWNER_ID ?? "20206208" } },
        tags: { data: ALL_TAGS },
      },
    },
  });
  results.b_with_owner_rel = {
    status: b.status,
    id:     b.body?.data?.id,
    owner:  b.body?.data?.relationships?.owner,
    errors: b.body?.errors,
  };

  // Test C: PAT Basic auth (not OAuth) — no owner field — does PCO auto-assign from PAT identity?
  const patBasic = "Basic " + Buffer.from(
    `${process.env.PCO_APP_ID ?? ""}:${process.env.PCO_PAT ?? process.env.PCO_SECRET ?? ""}`
  ).toString("base64");
  const cRes = await fetch(`${PCO_BASE}/calendar/v2/events`, {
    method: "POST",
    headers: { Authorization: patBasic, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      data: {
        type: "Event",
        attributes: { name: "BX Debug PAT-No-Owner — DELETE ME" },
        relationships: { tags: { data: ALL_TAGS } },
      },
    }),
  });
  const cText = await cRes.text();
  const cBody = (() => { try { return JSON.parse(cText); } catch { return cText; } })();
  results.c_pat_no_owner = {
    status: cRes.status,
    id:     cBody?.data?.id,
    owner:  cBody?.data?.relationships?.owner,
    errors: cBody?.errors,
  };

  return NextResponse.json(results);
}
