// ─── Room pricing — shared by the booking page estimate and the server ──────
// From the BX rate sheet: each room has a 4-hour price (non-profit and
// standard) and an hourly rate for each hour past 4 (the same for both).
// Extra time is billed by the half hour, rounded up. Client-safe.

import { ROOMS } from "@/lib/rooms";

export const BLOCK_HOURS = 4;
export interface RoomPrice { np: number; std: number; extra: number }
export type PriceList = Record<string, RoomPrice>;

/** The rate sheet in lib/rooms — used until the price list loads, and as a fallback. */
/** Rate sheet: each additional hour */
const EXTRA_HOUR: Record<string, number> = { crossing: 75, loft: 50 };
export const DEFAULT_EXTRA_HOUR = 25;

export const DEFAULT_PRICES: PriceList = Object.fromEntries(
  ROOMS.map((r) => [r.id, { np: r.baseNP, std: r.basePro, extra: EXTRA_HOUR[r.id] ?? DEFAULT_EXTRA_HOUR }]),
);

/** Start and end of each time-of-day choice on the booking page. */
export const SLOT_TIMES: Record<string, [string, string]> = {
  morning: ["08:00", "12:00"],
  afternoon: ["12:00", "17:00"],
  evening: ["17:00", "22:00"],
  any: ["08:00", "22:00"],
};

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const mins = (t: string) => { const m = HM.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PricedDay { date?: string; timeSlot?: string; customStart?: string; customEnd?: string }

/** Hours booked on a day: custom times win, otherwise the time-of-day choice. */
export function dayHours(day: PricedDay): number {
  const s = mins(String(day.customStart ?? "")), e = mins(String(day.customEnd ?? ""));
  if (Number.isFinite(s) && Number.isFinite(e) && e > s) return (e - s) / 60;
  const [a, b] = SLOT_TIMES[String(day.timeSlot ?? "any")] ?? SLOT_TIMES.any;
  return (mins(b) - mins(a)) / 60;
}

export interface RoomQuote {
  block: number;        // 4-hour price
  hourly: number;       // each hour past 4 (the rate sheet's additional-hour rate)
  extraHours: number;   // billed extra hours (half-hour steps)
  amount: number;
}

export function quoteRoom(price: RoomPrice | undefined, isNP: boolean, hours: number): RoomQuote {
  const block = price ? (isNP ? price.np : price.std) : 0;
  const hourly = price ? price.extra : 0;
  const extraHours = Math.max(0, Math.ceil((hours - BLOCK_HOURS) * 2 - 1e-9) / 2);
  return { block, hourly, extraHours, amount: round2(block + extraHours * hourly) };
}

/** Every room on a day is priced — including ones still waiting on availability. */
export function dayTotal(day: PricedDay & { rooms?: { roomId: string }[] }, prices: PriceList, isNP: boolean): number {
  const hours = dayHours(day);
  const ids = [...new Set((day.rooms ?? []).map((r) => r.roomId))].filter((id) => prices[id]);
  return round2(ids.reduce((s, id) => s + quoteRoom(prices[id], isNP, hours).amount, 0));
}

/** $50, or $118.75 when there are cents */
export const usdShort = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });

export const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1).replace(/\.0$/, "")} hr${h === 1 ? "" : "s"}`;
