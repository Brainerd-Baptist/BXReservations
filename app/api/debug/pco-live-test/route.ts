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
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

/**
 * GET /api/debug/pco-live-test
 * Smoke-test: checks People /me, Calendar /me person, then tries event creation.
 */
export async function GET() {
  // 1. PCO People — who am I?
  const meRes = await pcoRaw("/people/v2/me");
  const meId   = meRes.body?.data?.id ?? null;
  const meName = meRes.body?.data?.attributes?.name ?? null;

  // 2. Does this person have a PCO Calendar person record?
  //    Try /calendar/v2/people/<meId> — will 404 if no Calendar user.
  const calPersonRes = meId ? await pcoRaw(`/calendar/v2/people/${meId}`) : null;
  const calPerson = calPersonRes?.body?.data ?? null;
  const calPersonName = calPerson?.attributes?.name ?? null;
  const calPersonStatus = calPersonRes?.status ?? null;

  // 3. Try creating an event
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
    calendarPerson: { id: calPerson?.id, name: calPersonName, status: calPersonStatus },
    ok: !!pcoEventId,
    pcoEventId,
  });
}
