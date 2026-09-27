import { NextResponse } from "next/server";
import { pcoCreateEvent } from "@/lib/pco";

/**
 * GET /api/debug/pco-live-test
 * Smoke-test: creates a real draft PCO event and returns the event ID.
 * REMOVE after confirming PCO writes work end-to-end.
 */
export async function GET() {
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

  return NextResponse.json({ ok: !!pcoEventId, pcoEventId });
}
