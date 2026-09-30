import { blackoutReason, type BlackoutRule, type TimeSlot } from "@/lib/blackouts";
import { venueToday, isYmd, formatYmd } from "@/lib/dates";
import { ROOMS } from "@/lib/rooms";

export interface CheckDay {
  date: string;
  included: boolean;
  timeSlot?: string;
  rooms: { roomId: string }[];
}

// ─── Server-side date checks (C2) ─────────────────────────────────────────────
const KNOWN_ROOMS = new Set(ROOMS.map((r) => r.id));
const NAMED_SLOTS = new Set(["morning", "afternoon", "evening"]);

/**
 * A plain-English problem with the requested days, or null when they're fine.
 * Mirrors the booking form exactly: at least one included day with a space;
 * full-day blackouts block any time; part-day rules block only that named
 * slot ("All day" is checked against full-day rules only, as in the form).
 */
export function checkDays(days: CheckDay[] | undefined, rules: BlackoutRule[]): string | null {
  const included = (days ?? []).filter((d) => d?.included);
  const withRooms = included.filter((d) => (d.rooms ?? []).some((r) => r?.roomId));
  if (!withRooms.length) return "Please choose at least one day and space";
  const today = venueToday();
  for (const d of withRooms) {
    if (!isYmd(d.date)) return "One of the dates isn't valid";
    if (d.date < today) return `${formatYmd(d.date)} has already passed`;
    if (d.rooms.some((r) => r?.roomId && !KNOWN_ROOMS.has(r.roomId))) return "One of the spaces isn't available to book";
    const slot = String(d.timeSlot ?? "");
    const reason = blackoutReason(d.date, NAMED_SLOTS.has(slot) ? (slot as TimeSlot) : null, rules);
    if (reason) return `${formatYmd(d.date)} isn't available (${reason})`;
  }
  return null;
}

