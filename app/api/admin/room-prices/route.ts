import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireStaff, requireSysadmin } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { getUserAndRole } from "@/lib/get-user-role";
import { ROOMS } from "@/lib/rooms";
import { readRoomPrices, ROOM_PRICES_TAG } from "@/lib/room-prices";

const ROOM_IDS = new Set(ROOMS.map((r) => r.id));

// GET — the room price list (staff can read it)
export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  try {
    return NextResponse.json({ prices: await readRoomPrices(adminClient()) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PATCH { room_id, np, std, extra } — Owner / System Admin. New bookings use it right
// away; existing bookings keep their price until staff press Recalculate.
export async function PATCH(req: NextRequest) {
  const denied = await requireSysadmin();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { room_id?: unknown; np?: unknown; std?: unknown; extra?: unknown };
  const roomId = String(b.room_id ?? "");
  if (!ROOM_IDS.has(roomId)) return NextResponse.json({ error: "Unknown room" }, { status: 400 });
  const np = Number(b.np), std = Number(b.std), extra = Number(b.extra);
  if (![np, std, extra].every((n) => Number.isFinite(n) && n >= 0 && n <= 100000)) {
    return NextResponse.json({ error: "Enter prices of $0 or more." }, { status: 400 });
  }
  const { user } = await getUserAndRole();
  const db = adminClient();
  const { error } = await db.from("bx_room_prices").upsert({
    room_id: roomId, block_np: Math.round(np * 100) / 100, block_std: Math.round(std * 100) / 100, extra_hour: Math.round(extra * 100) / 100,
    updated_at: new Date().toISOString(), updated_by: user?.id ?? null,
  }, { onConflict: "room_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag(ROOM_PRICES_TAG, { expire: 0 });
  return NextResponse.json({ prices: await readRoomPrices(db) });
}
