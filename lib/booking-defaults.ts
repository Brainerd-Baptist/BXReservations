// What the renter asked for on the booking form, per room and day — the
// baseline for staff outputs and the one-tap default in the map planner when
// nobody has opened the Event Map. Client-safe (no server imports).

import { RESERVATION_ROOM_TO_MAP, SETUP_LABELS, type SetupStyle } from "@/lib/event-map";

/** The reserve form's own vocabulary. */
const BOOKING_SETUP_LABEL: Record<string, string> = {
  theater: "Theater",
  banquet: "Banquet (rounds)",
  classroom: "Classroom",
  reception: "Reception — mixed seating and open floor",
  cocktail: "Cocktail — high-tops, mostly standing",
  boardroom: "Boardroom",
  custom: "Custom",
};
/** Where the booking form's choice maps cleanly onto a map preset. */
const BOOKING_TO_PRESET: Record<string, SetupStyle> = {
  theater: "theater",
  classroom: "classroom",
  boardroom: "boardroom",
  banquet: "rounds_8",
};

export interface BookingDefault {
  room_id: string;      // map room id (the catalogue room's main map room)
  day_index: number;    // index into reservationDates(payload)
  label: string;        // human line: "Theater · 50 people"
  preset: SetupStyle | null;
  chairs: number | null;
  custom: string | null;
}

interface PayloadRoom { roomId?: string; setup?: string; customSetup?: string }
interface PayloadDay { date?: string; included?: boolean; headcount?: number; rooms?: PayloadRoom[] }

/** One default per reserved main map room per event day, from the booking form. */
export function bookingDefaults(payload: unknown): BookingDefault[] {
  const days = ((payload as { days?: PayloadDay[] } | null)?.days ?? []).filter((d) => d && d.date && d.included !== false);
  const dates = [...new Set(days.map((d) => String(d.date)))].sort();
  const out: BookingDefault[] = [];
  for (const d of days) {
    const day_index = dates.indexOf(String(d.date));
    const headcount = Number(d.headcount) || null;
    for (const r of d.rooms ?? []) {
      const ids = RESERVATION_ROOM_TO_MAP[r?.roomId ?? ""];
      if (!ids?.length) continue;
      const setup = (r.setup ?? "").trim();
      const custom = setup === "custom" && r.customSetup?.trim() ? r.customSetup.trim() : null;
      const preset = BOOKING_TO_PRESET[setup] ?? null;
      const setupText = custom ?? (setup ? BOOKING_SETUP_LABEL[setup] ?? setup : "");
      const parts = [setupText, headcount ? `${headcount} people` : ""].filter(Boolean);
      if (!parts.length) continue;
      out.push({ room_id: ids[0], day_index, label: parts.join(" · "), preset, chairs: headcount, custom });
    }
  }
  return out;
}

/** The booking line for a room on a day (or the first day when day is null). */
export function bookingLineFor(defaults: BookingDefault[], roomId: string, day: number | null): string | null {
  const d = defaults.find((x) => x.room_id === roomId && x.day_index === (day ?? 0)) ?? defaults.find((x) => x.room_id === roomId);
  return d ? d.label : null;
}

export const presetLabel = (p: SetupStyle | null) => (p ? SETUP_LABELS[p] : null);
