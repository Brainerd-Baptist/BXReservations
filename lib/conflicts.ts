import type { SupabaseClient } from "@supabase/supabase-js";
import { ROOMS } from "@/lib/rooms";
import { isClosedStatus } from "@/lib/dates";
import { roomSignals, SLOT_HOURS, type TimeSlot } from "@/lib/pco-availability";
import { blackoutReason, type BlackoutRule } from "@/lib/blackouts";

export type ScheduleDay = {
  date: string; included?: boolean; customStart?: string; customEnd?: string; timeSlot?: string;
  rooms?: { roomId: string; requested?: boolean }[];
};

export interface Conflict {
  date: string;
  roomId: string | null;
  kind: "booking" | "calendar" | "window";
  /** "hard" = something is really there; "soft" = maybe (pending on the church calendar, outside public hours) */
  level: "hard" | "soft";
  message: string;
  otherId?: string;
}

const roomName = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;
const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + (m || 0); };
const fmt = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60, ap = h >= 12 && h < 24 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${ap}`;
};

/** A day's time window in minutes since midnight (ET). */
export function windowOf(d: ScheduleDay): [number, number] {
  if (d.customStart && d.customEnd) return [toMin(d.customStart), toMin(d.customEnd)];
  const [a, b] = SLOT_HOURS[(d.timeSlot as TimeSlot) in SLOT_HOURS ? (d.timeSlot as TimeSlot) : "any"];
  return [a * 60, b * 60];
}
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];
const roomsOf = (d: ScheduleDay) => (d.rooms ?? []).filter((r) => r.requested !== false).map((r) => r.roomId);
const slotsTouched = (w: [number, number]): TimeSlot[] =>
  (["morning", "afternoon", "evening"] as TimeSlot[]).filter((s) => overlaps(w, [SLOT_HOURS[s][0] * 60, SLOT_HOURS[s][1] * 60]));

/**
 * What might clash with a proposed schedule, for the days/rooms/times that
 * CHANGED from `before` (unchanged parts were already accepted):
 *  - another open BX booking in the same room at an overlapping time
 *  - the church's Planning Center calendar (approved = hard, pending = soft)
 *  - the public booking windows (blackouts) — soft, staff may book outside them
 */
export async function findConflicts(
  db: SupabaseClient,
  reservationId: string,
  before: ScheduleDay[],
  after: ScheduleDay[],
): Promise<Conflict[]> {
  const changed: { day: ScheduleDay; rooms: string[] }[] = [];
  for (const d of after) {
    if (d.included === false) continue;
    const prev = before.find((b) => b.date === d.date && b.included !== false);
    const w = windowOf(d);
    const rooms = roomsOf(d).filter((r) => {
      if (!prev) return true;
      if (!roomsOf(prev).includes(r)) return true;
      const pw = windowOf(prev);
      return w[0] < pw[0] || w[1] > pw[1];   // widened the time
    });
    if (rooms.length || !prev) changed.push({ day: d, rooms: rooms.length ? rooms : roomsOf(d) });
  }
  if (!changed.length) return [];

  const out: Conflict[] = [];

  // 1) Other BX bookings
  const { data: others } = await db
    .from("reservations")
    .select("id, booking_number, event_name, status, payload")
    .neq("id", reservationId)
    .limit(1000);
  for (const { day, rooms } of changed) {
    const w = windowOf(day);
    for (const o of others ?? []) {
      if (isClosedStatus(o.status) || ["declined", "expired"].includes(o.status ?? "")) continue;
      const odays = ((o.payload as { days?: ScheduleDay[] } | null)?.days ?? []).filter((x) => x.date === day.date && x.included !== false);
      for (const od of odays) {
        if (!overlaps(w, windowOf(od))) continue;
        for (const room of roomsOf(od).filter((r) => rooms.includes(r))) {
          const ow = windowOf(od);
          out.push({
            date: day.date, roomId: room, kind: "booking", level: o.status === "pending" ? "soft" : "hard", otherId: o.id,
            message: `${roomName(room)} is also booked for ${o.event_name ?? "another event"} (${o.booking_number ?? "BX"}, ${fmt(ow[0])}–${fmt(ow[1])}${o.status === "pending" ? ", still a request" : ""}).`,
          });
        }
      }
    }
  }

  // 2) Planning Center calendar
  await Promise.all(changed.map(async ({ day, rooms }) => {
    const w = windowOf(day);
    try {
      const signals = await roomSignals(day.date, w[0] / 60, w[1] / 60, rooms);
      for (const room of rooms) {
        const s = signals[room];
        if (s === "unavailable") out.push({ date: day.date, roomId: room, kind: "calendar", level: "hard", message: `${roomName(room)} has an approved event on the church calendar at that time.` });
        else if (s === "ask") out.push({ date: day.date, roomId: room, kind: "calendar", level: "soft", message: `${roomName(room)} has a pending request on the church calendar at that time.` });
      }
    } catch { /* calendar unreachable — don't block the edit */ }
  }));

  // 3) Public booking windows
  const { data: rules } = await db.from("blackout_rules").select("*").eq("active", true);
  for (const { day } of changed) {
    const w = windowOf(day);
    const reasons = new Set<string>();
    const whole = blackoutReason(day.date, null, (rules ?? []) as BlackoutRule[]);
    if (whole) reasons.add(whole);
    for (const s of slotsTouched(w)) {
      const r = blackoutReason(day.date, s, (rules ?? []) as BlackoutRule[]);
      if (r) reasons.add(r);
    }
    for (const r of reasons) out.push({ date: day.date, roomId: null, kind: "window", level: "soft", message: `Outside the public booking window (${r}).` });
  }

  // One line per message
  const seen = new Set<string>();
  return out.filter((c) => { const k = `${c.date}|${c.message}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.level === b.level ? 0 : a.level === "hard" ? -1 : 1));
}
