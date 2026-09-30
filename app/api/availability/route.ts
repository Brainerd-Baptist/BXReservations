import { NextRequest, NextResponse } from "next/server";
import { roomSignals, ROOM_RESOURCE_IDS, SLOT_HOURS, type TimeSlot } from "@/lib/pco-availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const timeSlotParam = (searchParams.get("timeSlot") ?? "any") as TimeSlot;
  const roomParam = searchParams.get("rooms");

  if (!date) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  const rooms = roomParam
    ? roomParam.split(",").map(r => r.trim())
    : Object.keys(ROOM_RESOURCE_IDS);

  const slot: TimeSlot = SLOT_HOURS[timeSlotParam] ? timeSlotParam : "any";
  const [startHour, endHour] = SLOT_HOURS[slot];
  const result = await roomSignals(date, startHour, endHour, rooms);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
