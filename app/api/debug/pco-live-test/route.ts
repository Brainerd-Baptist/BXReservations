import { NextResponse } from "next/server";
import { pcoCreateEvent } from "@/lib/pco";

const PCO_BASE = "https://api.planningcenteronline.com";

function authHeader(): string {
  const id     = process.env.PCO_APP_ID ?? "";
  const secret = process.env.PCO_PAT ?? process.env.PCO_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function pcoRaw(path: string) {
  const res = await fetch(`${PCO_BASE}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) };
}

/**
 * GET /api/debug/pco-live-test
 * Smoke-test: checks authenticated user identity, then tries event creation.
 * REMOVE after confirming PCO writes work end-to-end.
 */
export async function GET() {
  // 1. Who are we authenticated as?
  const meRes = await pcoRaw("/people/v2/me");
  const meId   = meRes.body?.data?.id ?? null;
  const meName = meRes.body?.data?.attributes?.name ?? null;

  // 2. Try creating an event
  const pcoEventId = await pcoCreateEvent({
    eventName: "BX Auth Test — DELETE ME",
    orgName:   "Claude Debug",
    notes:     "Automated auth smoke test — safe to delete",
    bookingNumber: "BX-TEST-001",
    days: [
      {
        date:        "2026-10-01",
        included:    true,
        customStart: "09:00",
        customEnd:   "11:00",
        timeSlot:    "morning",
        headcount:   1,
      },
    ],
  });

  return NextResponse.json({
    auth: { meId, meName, meStatus: meRes.status },
    ok: !!pcoEventId,
    pcoEventId,
  });
}
