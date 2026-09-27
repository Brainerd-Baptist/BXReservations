import { NextResponse } from "next/server";

const PCO_BASE = "https://api.planningcenteronline.com";
const ME_ID    = "20206208";

const ALL_TAGS = [
  { type: "Tag", id: "430562" },
  { type: "Tag", id: "70490"  },
  { type: "Tag", id: "248327" },
  { type: "Tag", id: "241212" },
];

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
  const results: Record<string, unknown> = {};

  // Test A: owner as "null_person" (sentinel that exists in this org)
  const a = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug A — DELETE ME" },
      relationships: {
        tags:  { data: ALL_TAGS },
        owner: { data: { type: "Person", id: "null_person" } },
      },
    },
  });
  results.a_null_person_owner = { status: a.status, id: a.body?.data?.id, errors: a.body?.errors };

  // Test B: owner as numeric integer instead of string
  const b = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: {
        name:     "BX Debug B — DELETE ME",
        owner_id: Number(ME_ID),  // numeric, not string
      },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.b_numeric_owner_id = { status: b.status, id: b.body?.data?.id, errors: b.body?.errors };

  // Test C: POST to /calendar/v2/event_resource_requests without event
  //         (to see if PCO supports standalone room-request creation)
  const c = await pcoRaw("/calendar/v2/event_resource_requests", "POST", {
    data: {
      type: "EventResourceRequest",
      attributes: {
        approval_status: "P",
        starts_at: "2026-10-01T09:00:00.000Z",
        ends_at:   "2026-10-01T11:00:00.000Z",
      },
      relationships: {
        resource: { data: { type: "Resource", id: "355074" } }, // The Crossing
      },
    },
  });
  results.c_standalone_resource_req = { status: c.status, id: c.body?.data?.id, errors: c.body?.errors };

  // Test D: Fetch the existing "null_person" event to check its full structure
  const d = await pcoRaw("/calendar/v2/events/1541619?include=owner");
  results.d_null_event_structure = {
    status: d.status,
    owner:  d.body?.data?.relationships?.owner,
    attrs:  d.body?.data?.attributes,
  };

  return NextResponse.json(results);
}
