import { NextResponse } from "next/server";

const PCO_BASE  = "https://api.planningcenteronline.com";
const TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";

const ALL_TAGS = [
  { type: "Tag", id: "430562" },
  { type: "Tag", id: "70490"  },
  { type: "Tag", id: "248327" },
  { type: "Tag", id: "241212" },
];

interface TokenResult {
  accessToken: string | null;
  newRefreshToken: string | null;
  refreshBody: unknown;
  refreshStatus: number;
}

async function refreshTokenOnce(): Promise<TokenResult> {
  const refreshToken = process.env.PCO_REFRESH_TOKEN;
  if (!refreshToken) {
    return { accessToken: null, newRefreshToken: null, refreshBody: null, refreshStatus: 0 };
  }
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
  const text = await res.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(text) as Record<string, unknown>; }
  catch { body = { raw: text }; }

  return {
    accessToken:     (body.access_token  as string) ?? null,
    newRefreshToken: (body.refresh_token as string) ?? null,
    refreshBody:     body,
    refreshStatus:   res.status,
  };
}

function makeHeaders(accessToken: string | null): Record<string, string> {
  const auth = accessToken
    ? `Bearer ${accessToken}`
    : "Basic " + Buffer.from(
        `${process.env.PCO_APP_ID ?? ""}:${process.env.PCO_PAT ?? process.env.PCO_SECRET ?? ""}`
      ).toString("base64");
  return { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" };
}

async function pcoRaw(path: string, method = "GET", accessToken: string | null, body?: unknown) {
  const res = await fetch(`${PCO_BASE}${path}`, {
    method,
    headers: makeHeaders(accessToken),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

export async function GET() {
  const results: Record<string, unknown> = {};

  const refreshToken = process.env.PCO_REFRESH_TOKEN;
  results.has_refresh_token = !!refreshToken;
  results.refresh_token_len = refreshToken?.length ?? 0;

  const { accessToken, newRefreshToken, refreshBody, refreshStatus } = await refreshTokenOnce();

  results.token_refresh = { status: refreshStatus, body: refreshBody };
  results.auth_method   = accessToken ? "oauth_bearer" : "pat_basic";

  // IMPORTANT: Save this IMMEDIATELY to Vercel PCO_REFRESH_TOKEN
  results.new_refresh_token_SAVE_NOW = newRefreshToken ?? "(none returned)";

  // D1: Identify the OAuth user via People module (requires 'people' scope)
  const meRes = await pcoRaw("/people/v2/me", "GET", accessToken);
  results.d_me = {
    status: meRes.status,
    id:     meRes.body?.data?.id,
    name:   meRes.body?.data?.attributes?.name,
    note:   meRes.status === 401 ? "401 = token lacks 'people' scope; re-auth at /api/pco-auth/start" : undefined,
  };

  // D2: Fetch Josiah's Calendar person record by ID
  const calPersonRes = await pcoRaw("/calendar/v2/people/20206208", "GET", accessToken);
  results.d_cal_person_20206208 = {
    status:                  calPersonRes.status,
    id:                      calPersonRes.body?.data?.id,
    event_permissions_type:  calPersonRes.body?.data?.attributes?.event_permissions_type,
    has_access:              calPersonRes.body?.data?.attributes?.has_access,
    errors:                  calPersonRes.body?.errors,
  };

  // D3: Paginate Calendar people to see if Josiah (20206208) appears in the list
  const calPeopleP1 = await pcoRaw("/calendar/v2/people?per_page=100&offset=0", "GET", accessToken);
  const calPeopleP2 = await pcoRaw("/calendar/v2/people?per_page=100&offset=100", "GET", accessToken);
  const page1People = (calPeopleP1.body?.data ?? []) as {id: string; attributes: {name: string}}[];
  const page2People = (calPeopleP2.body?.data ?? []) as {id: string; attributes: {name: string}}[];
  const allCalPeople = [...page1People, ...page2People];
  results.d_cal_people = {
    status:              calPeopleP1.status,
    total_count:         calPeopleP1.body?.meta?.total_count,
    josiah_in_list:      allCalPeople.some(p => p.id === "20206208"),
    count_fetched:       allCalPeople.length,
    sample:              allCalPeople.slice(0, 10).map(p => ({ id: p.id, name: p.attributes?.name })),
  };

  // D4: Filter Calendar people where id = 20206208
  const calPeopleFilterRes = await pcoRaw("/calendar/v2/people?where[id]=20206208", "GET", accessToken);
  results.d_cal_people_filter_josiah = {
    status:      calPeopleFilterRes.status,
    count:       (calPeopleFilterRes.body?.data ?? []).length,
    data:        calPeopleFilterRes.body?.data,
    errors:      calPeopleFilterRes.body?.errors,
  };

  // Test A: No owner — let PCO auto-assign from OAuth session
  const a = await pcoRaw("/calendar/v2/events", "POST", accessToken, {
    data: {
      type: "Event",
      attributes: { name: "BX Debug No-Owner - DELETE ME" },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.a_no_owner = {
    status: a.status,
    id:     a.body?.data?.id,
    owner:  a.body?.data?.relationships?.owner,
    errors: a.body?.errors,
  };

  // Test B: Owner as JSON:API relationship
  const b = await pcoRaw("/calendar/v2/events", "POST", accessToken, {
    data: {
      type: "Event",
      attributes: { name: "BX Debug Owner-Rel - DELETE ME" },
      relationships: {
        owner: { data: { type: "Person", id: process.env.PCO_OWNER_ID ?? "20206208" } },
        tags:  { data: ALL_TAGS },
      },
    },
  });
  results.b_with_owner_rel = {
    status: b.status,
    id:     b.body?.data?.id,
    owner:  b.body?.data?.relationships?.owner,
    errors: b.body?.errors,
  };

  // Test C: No tags — isolate whether required tag groups affect owner validation
  const c = await pcoRaw("/calendar/v2/events", "POST", accessToken, {
    data: {
      type: "Event",
      attributes: { name: "BX Debug No-Tags - DELETE ME" },
    },
  });
  results.c_no_tags = {
    status: c.status,
    id:     c.body?.data?.id,
    owner:  c.body?.data?.relationships?.owner,
    errors: c.body?.errors,
  };

  return NextResponse.json(results);
}
