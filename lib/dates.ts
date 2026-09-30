/**
 * Venue calendar dates — one set of rules for every screen (audit F09).
 *
 * Reservation days are stored as calendar dates ("2026-10-21"), not instants.
 * `new Date("2026-10-21")` reads that as midnight UTC, which is Oct 20 in
 * Chattanooga — so dates displayed a day early and today's events moved to
 * "Past" in the morning. These helpers never treat a calendar date as UTC,
 * and "today" is always today at the BX (America/New_York).
 */

export const VENUE_TZ = "America/New_York";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const isYmd = (s: unknown): s is string => typeof s === "string" && YMD.test(s);

/** Today's date at the venue, as YYYY-MM-DD. */
export function venueToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: VENUE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const utcOf = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from venue-today to `ymd` (0 = today, negative = past). */
export function daysFromToday(ymd: string, now: Date = new Date()): number {
  return Math.round((utcOf(ymd) - utcOf(venueToday(now))) / 86_400_000);
}

/** Format a calendar date without any timezone shift. */
export function formatYmd(ymd: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(utcOf(ymd));
}

/** Format either a calendar date or a timestamp, in venue time. */
export function formatDateish(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string | null {
  if (!value) return null;
  if (isYmd(value)) return formatYmd(value, opts);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: VENUE_TZ }).format(d);
}

/** The first 10 chars of a timestamp or date, as a venue calendar date. */
export function toVenueYmd(value: string): string {
  if (isYmd(value)) return value;
  return venueToday(new Date(value));
}

type PayloadDay = { date?: string; included?: boolean };

/** Days the requester kept in the booking (excluded days don't count). */
export function includedDates(payload: unknown): string[] {
  const days = ((payload as { days?: PayloadDay[] } | null)?.days ?? []) as PayloadDay[];
  return days
    .filter((d) => d && d.included !== false && isYmd(d.date))
    .map((d) => d.date as string)
    .sort();
}

/** Every status that means the reservation is finished or off. */
export const CLOSED_STATUSES = new Set([
  "cancelled",
  "cancelled_by_user",
  "cancelled_by_admin",
  "auto_cancelled",
  "rejected",
  "completed",
]);
export const isClosedStatus = (status: string | null | undefined) => CLOSED_STATUSES.has(status ?? "");

/**
 * Upcoming = still open AND its last included day is today or later.
 * A multi-day event stays upcoming until its final day is over.
 * With no dates yet (a draft-like request), an open reservation is upcoming.
 */
export function isUpcoming(status: string | null | undefined, payload: unknown, now: Date = new Date()): boolean {
  if (isClosedStatus(status)) return false;
  const dates = includedDates(payload);
  if (dates.length === 0) return true;
  return dates[dates.length - 1] >= venueToday(now);
}
