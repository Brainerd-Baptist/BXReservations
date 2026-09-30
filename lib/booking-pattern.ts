// A reusable booking "pattern": which spaces, setup, time and headcount — no
// dates. Used by "Book again" (from a past booking) and by staff-made
// templates. Dates are always picked fresh; the pattern fills each day.
import { ROOMS } from "@/lib/rooms";

export const SLOTS = ["any", "morning", "afternoon", "evening"] as const;
export const SETUPS = ["", "theater", "banquet", "classroom", "reception", "cocktail", "boardroom", "custom"] as const;
export const SPACE_MODES = ["single", "main-plus", "multiple"] as const;

export interface PatternRoom { roomId: string; setup: (typeof SETUPS)[number]; customSetup: string; role: "main" | "extra" }
export interface BookingPattern {
  spaceMode: (typeof SPACE_MODES)[number];
  headcount: number;
  timeSlot: (typeof SLOTS)[number];
  customStart: string;
  customEnd: string;
  rooms: PatternRoom[];
  eventName?: string;
  org?: string;
  isNonProfit?: boolean;
  notes?: string;
  addons?: Record<string, number>;
}

const KNOWN = new Set(ROOMS.map((r) => r.id));
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Clean any input into a safe pattern, or null if it names no bookable space. */
export function sanitizePattern(input: unknown): BookingPattern | null {
  const p = (input ?? {}) as Record<string, unknown>;
  const rooms: PatternRoom[] = (Array.isArray(p.rooms) ? p.rooms : [])
    .map((r: Record<string, unknown>) => ({
      roomId: str(r?.roomId, 40),
      setup: (SETUPS as readonly string[]).includes(String(r?.setup ?? "")) ? (String(r?.setup ?? "") as PatternRoom["setup"]) : "",
      customSetup: str(r?.customSetup, 200),
      role: r?.role === "main" ? "main" : "extra",
    }) as PatternRoom)
    .filter((r, i, all) => KNOWN.has(r.roomId) && all.findIndex((x) => x.roomId === r.roomId) === i)
    .slice(0, 12);
  if (!rooms.length) return null;
  const hc = Math.round(Number(p.headcount));
  const addons: Record<string, number> = {};
  if (p.addons && typeof p.addons === "object") {
    for (const [k, v] of Object.entries(p.addons as Record<string, unknown>)) {
      const n = Math.round(Number(v));
      if (/^[0-9a-f-]{36}$/i.test(k) && n > 0 && n <= 999) addons[k] = n;
    }
  }
  return {
    spaceMode: (SPACE_MODES as readonly string[]).includes(String(p.spaceMode)) ? (p.spaceMode as BookingPattern["spaceMode"]) : "single",
    headcount: Number.isFinite(hc) && hc > 0 ? Math.min(hc, 5000) : 50,
    timeSlot: (SLOTS as readonly string[]).includes(String(p.timeSlot)) ? (p.timeSlot as BookingPattern["timeSlot"]) : "any",
    customStart: HHMM.test(String(p.customStart ?? "")) ? String(p.customStart) : "",
    customEnd: HHMM.test(String(p.customEnd ?? "")) ? String(p.customEnd) : "",
    rooms,
    eventName: str(p.eventName, 120) || undefined,
    org: str(p.org, 120) || undefined,
    isNonProfit: typeof p.isNonProfit === "boolean" ? p.isNonProfit : undefined,
    notes: str(p.notes, 2000) || undefined,
    addons: Object.keys(addons).length ? addons : undefined,
  };
}

/** The pattern of a stored booking: its first included day that has spaces. */
export function patternFromPayload(payload: unknown, addons?: Record<string, number>): BookingPattern | null {
  const pl = (payload ?? {}) as { days?: Record<string, unknown>[]; spaceMode?: string; notes?: string; contact?: Record<string, unknown> };
  const day = (pl.days ?? []).find((d) => d?.included !== false && Array.isArray(d?.rooms) && (d.rooms as unknown[]).length);
  if (!day) return null;
  return sanitizePattern({
    ...day,
    spaceMode: pl.spaceMode,
    eventName: pl.contact?.eventName,
    org: pl.contact?.org,
    isNonProfit: pl.contact?.isNonProfit,
    notes: pl.notes,
    addons,
  });
}

/** One line for lists: "The Crossing (banquet) · Evening · 120 people". */
export function describePattern(p: BookingPattern): string {
  const room = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;
  const rooms = p.rooms.map((r) => (r.setup && r.setup !== "custom" ? `${room(r.roomId)} (${r.setup})` : room(r.roomId))).join(", ");
  const time = p.customStart && p.customEnd ? `${p.customStart}–${p.customEnd}` : p.timeSlot === "any" ? "All day" : p.timeSlot[0].toUpperCase() + p.timeSlot.slice(1);
  return `${rooms} · ${time} · ${p.headcount} people`;
}
