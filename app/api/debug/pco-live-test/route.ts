import { NextResponse } from "next/server";
import { pcoCreateEvent, pcoCancelEvent } from "@/lib/pco";

/**
 * GET /api/debug/pco-live-test
 * Runs pcoCreateEvent() with a test payload and immediately cancels it.
 * Confirms the actual code path works end-to-end. REMOVE after debugging.
 */
export async function GET() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ds = tomorrow.toISOString().slice(0, 10);

  const pcoEventId = await pcoCreateEvent({
    eventName:     "BX Live Test (auto-cancel)",
    orgName:       "Debug",
    notes:         "Auto-generated test — safe to ignore",
    bookingNumber: "BX-DEBUG-0000",
    days: [{
      date:        ds,
      included:    true,
      headcount:   10,
      timeSlot:    "morning",
      customStart: "",
      customEnd:   "",
    }],
  }).catch((err: unknown) => {
    return { error: String(err) };
  });

  if (!pcoEventId || typeof pcoEventId !== "string") {
    return NextResponse.json({ ok: false, result: pcoEventId });
  }

  // Immediately cancel so it's flagged in PCO rather than sitting as Pending
  await pcoCancelEvent(pcoEventId).catch(() => {});

  return NextResponse.json({ ok: true, pcoEventId, message: "Event created and canceled in PCO" });
}
