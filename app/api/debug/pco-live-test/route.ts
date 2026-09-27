import { NextResponse } from "next/server";

const PCO_BASE = "https://api.planningcenteronline.com";

function authHeader(): string {
  const id     = process.env.PCO_APP_ID ?? "";
  const secret = process.env.PCO_PAT ?? process.env.PCO_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function pcoRaw(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${PCO_BASE}${path}`, {
    method,
    headers: {
      Authorization:  authHeader(),
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
  // 1. PCO People /me
  const meRes = await pcoRaw("/people/v2/me");
  const meId   = meRes.body?.data?.id ?? null;
  const meName = meRes.body?.data?.attributes?.name ?? null;

  // 2. Try /calendar/v2/me  (may or may not exist)
  const calMeRes = await pcoRaw("/calendar/v2/me");

  // 3. Try a MINIMAL event POST with just name — no tags, no owner
  //    to see the full error list from PCO
  const minimalPost = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug Minimal — DELETE ME" },
    },
  });

  // 4. Try with approval_status + name only
  const withStatus = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: {
        name: "BX Debug w/status — DELETE ME",
        approval_status: "P",
      },
    },
  });

  // 5. Try with owner as relationship AND tags
  const withOwner = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug w/owner — DELETE ME" },
      relationships: {
        owner: { data: { type: "Person", id: meId } },
        tags: {
          data: [
            { type: "Tag", id: "430562" }, // Pending
            { type: "Tag", id: "70490"  }, // BX Venue
            { type: "Tag", id: "248327" }, // BX Events
            { type: "Tag", id: "241212" }, // BX Ministry
          ],
        },
      },
    },
  });

  return NextResponse.json({
    auth: { meId, meName },
    calendarMe: { status: calMeRes.status, data: calMeRes.body?.data ?? calMeRes.body },
    minimal: { status: minimalPost.status, errors: minimalPost.body?.errors ?? minimalPost.body },
    withStatus: { status: withStatus.status, errors: withStatus.body?.errors ?? withStatus.body?.data?.id },
    withOwner: { status: withOwner.status, errors: withOwner.body?.errors ?? withOwner.body?.data?.id },
  });
}
