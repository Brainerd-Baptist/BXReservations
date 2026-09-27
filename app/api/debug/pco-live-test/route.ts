import { NextResponse } from "next/server";

const PCO_BASE = "https://api.planningcenteronline.com";
const ME_ID    = "20206208"; // Josiah King — Calendar person confirmed

const ALL_TAGS = [
  { type: "Tag", id: "430562" }, // Pending
  { type: "Tag", id: "70490"  }, // BX Venue
  { type: "Tag", id: "248327" }, // BX Events
  { type: "Tag", id: "241212" }, // BX Ministry
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

  // Test A: standard /events with just name + tags (no owner) — baseline
  const a = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug A — DELETE ME" },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.a_standard = { status: a.status, body: a.body?.data?.id ?? a.body?.errors };

  // Test B: Try creating via person's sub-resource (if it exists)
  const b = await pcoRaw(`/calendar/v2/people/${ME_ID}/events`, "POST", {
    data: {
      type: "Event",
      attributes: { name: "BX Debug B — DELETE ME" },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.b_person_sub = { status: b.status, body: b.body?.data?.id ?? b.body?.errors ?? b.body };

  // Test C: Add visible_in_church_center: false — maybe that's a required attribute
  const c = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: {
        name: "BX Debug C — DELETE ME",
        visible_in_church_center: false,
      },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.c_with_church_center = { status: c.status, body: c.body?.data?.id ?? c.body?.errors };

  // Test D: Try PATCH on a known existing event — can we update it?
  // (Use event 1546261 = "Test event" owned by Barb)
  const d = await pcoRaw("/calendar/v2/events/1546261", "PATCH", {
    data: {
      type: "Event",
      id: "1546261",
      attributes: { summary: "BX API test patch" },
    },
  });
  results.d_patch_existing = { status: d.status, body: d.body?.data?.id ?? d.body?.errors };

  // Test E: Try creating event with ALL attributes in PCO docs
  const e = await pcoRaw("/calendar/v2/events", "POST", {
    data: {
      type: "Event",
      attributes: {
        name:                    "BX Debug E — DELETE ME",
        description:             "Test",
        summary:                 "Test",
        featured:                false,
        visible_in_church_center: false,
      },
      relationships: { tags: { data: ALL_TAGS } },
    },
  });
  results.e_full_attrs = { status: e.status, body: e.body?.data?.id ?? e.body?.errors };

  return NextResponse.json(results);
}
