// ─── Add-on pricing — shared by the booking page and the server ─────────────
// Plain add-ons: price × quantity (each / per day / flat per event).
// Room-only add-ons (e.g. the UHF mic is for the Crossing) only apply when the
// booking has one of those rooms. Hour-tiered add-ons (the Complete AV
// package) are priced per event day from that day's hours. Client-safe.

import type { Addon } from "@/lib/billing";
import { dayHours, fmtHours, type PricedDay } from "@/lib/pricing";

export interface HoursTier {
  type: "hours_tier";
  /** [up to this many hours, price], ascending */
  tiers: [number, number][];
  /** each hour past the last tier (billed by the half hour) */
  extra_hour: number;
}

export type AddonWithRules = Addon & { rooms?: string[] | null; pricing?: HoursTier | null };
type Day = PricedDay & { date?: string; included?: boolean; rooms?: { roomId: string }[] };

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export const isTiered = (a: { pricing?: HoursTier | null }): a is { pricing: HoursTier } =>
  a.pricing?.type === "hours_tier" && Array.isArray(a.pricing.tiers) && a.pricing.tiers.length > 0;

export function tierPrice(t: HoursTier, hours: number): number {
  const tiers = [...t.tiers].sort((a, b) => a[0] - b[0]);
  for (const [upTo, price] of tiers) if (hours <= upTo + 1e-9) return price;
  const [lastHours, lastPrice] = tiers[tiers.length - 1];
  const extra = Math.ceil((hours - lastHours) * 2 - 1e-9) / 2;
  return round2(lastPrice + extra * (t.extra_hour || 0));
}

/** "$425 up to 4 hrs · $525 up to 8 hrs · +$40/hr after" */
export function tierSummary(t: HoursTier): string {
  const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
  const parts = [...t.tiers].sort((a, b) => a[0] - b[0]).map(([h, p]) => `${usd(p)} up to ${fmtHours(h)}`);
  if (t.extra_hour) parts.push(`+${usd(t.extra_hour)}/hr after`);
  return parts.join(" · ");
}

const activeDays = (days: Day[]) => days.filter((d) => d.included !== false && d.date);
const dayHasRoom = (d: Day, rooms: string[] | null | undefined) =>
  !rooms?.length || (d.rooms ?? []).some((r) => rooms.includes(r.roomId));

/** Does the add-on fit this booking's rooms? */
export function addonApplies(a: AddonWithRules, days: Day[]): boolean {
  return activeDays(days).some((d) => dayHasRoom(d, a.rooms));
}

export interface AddonLine {
  label: string;
  unit_price: number;
  quantity: number;
  note: string | null;
  /** tiered lines follow the schedule */
  auto_key: string | null;
}

/** The charge lines one add-on adds to a booking. `free` = payment not needed. */
export function addonLines(a: AddonWithRules, qty: number, days: Day[], free = false): AddonLine[] {
  if (qty <= 0 || !addonApplies(a, days)) return [];
  const freeNote = free ? "No charge — church use" : null;  // matches CHURCH_NOTE in lib/room-prices
  if (isTiered(a)) {
    return activeDays(days).filter((d) => dayHasRoom(d, a.rooms)).map((d) => {
      const h = dayHours(d);
      return {
        label: `${a.name} · ${fmtDay(d.date!)} · ${fmtHours(h)}`,
        unit_price: free ? 0 : tierPrice(a.pricing, h),
        quantity: 1,
        note: freeNote,
        auto_key: `tier:${a.id}:${d.date}`,
      };
    });
  }
  const quantity = a.unit === "flat" ? 1 : qty;
  return [{ label: a.name, unit_price: free ? 0 : Number(a.price), quantity, note: freeNote, auto_key: null }];
}

export const addonTotal = (a: AddonWithRules, qty: number, days: Day[], free = false) =>
  round2(addonLines(a, qty, days, free).reduce((s, l) => s + l.unit_price * l.quantity, 0));
