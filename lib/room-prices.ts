import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { ROOMS } from "@/lib/rooms";
import { DEFAULT_PRICES, dayHours, fmtHours, quoteRoom, type PriceList } from "@/lib/pricing";
import { isClosedStatus } from "@/lib/dates";
import { readWaived } from "@/lib/waivers";
import { syncRewardDiscount } from "@/lib/survey";
import { addonLines, isTiered, type AddonWithRules } from "@/lib/addon-pricing";

export const ROOM_PRICES_TAG = "room-prices";

/** The price list from the database, laid over the rate sheet defaults. */
export async function readRoomPrices(db: SupabaseClient): Promise<PriceList> {
  const { data, error } = await db.from("bx_room_prices").select("room_id, block_np, block_std, extra_hour");
  if (error) throw new Error(error.message);
  const out: PriceList = { ...DEFAULT_PRICES };
  for (const r of data ?? []) {
    const fallback = DEFAULT_PRICES[r.room_id as string]?.extra ?? 0;
    out[r.room_id as string] = { np: Number(r.block_np), std: Number(r.block_std), extra: r.extra_hour == null ? fallback : Number(r.extra_hour) };
  }
  return out;
}

const cached = unstable_cache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return DEFAULT_PRICES;
  return readRoomPrices(createClient(url, key));
}, ["room-prices-v1"], { tags: [ROOM_PRICES_TAG], revalidate: 600 });

/** Cached for public pages; saving prices in Settings clears it. */
export async function getRoomPrices(): Promise<PriceList> {
  try { return await cached(); } catch { return DEFAULT_PRICES; }
}

export const ADDONS_TAG = "addon-catalog";
const cachedAddons = unstable_cache(async (): Promise<AddonWithRules[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const { data, error } = await createClient(url, key).from("bx_addons")
    .select("id, name, description, unit, price, active, sort, rooms, pricing").eq("active", true).order("sort").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as AddonWithRules[];
}, ["addon-catalog-v1"], { tags: [ADDONS_TAG], revalidate: 600 });

/** Active add-on catalog for the booking page (cached; Settings edits clear it). */
export async function getAddonCatalog(): Promise<AddonWithRules[]> {
  try { return await cachedAddons(); } catch { return []; }
}

const AUTO_PREFIX = "rental:";
const TIER_PREFIX = "tier:";
const roomName = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;
const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

type Day = { date?: string; included?: boolean; timeSlot?: string; customStart?: string; customEnd?: string; rooms?: { roomId: string }[] };

/** The room-rental lines a booking's schedule adds up to. */
export function rentalLines(days: Day[], prices: PriceList, isNP: boolean) {
  const lines: { auto_key: string; label: string; unit_price: number; note: string | null }[] = [];
  for (const d of days) {
    if (d.included === false || !d.date) continue;
    const hours = dayHours(d);
    const seen = new Set<string>();
    for (const rm of d.rooms ?? []) {
      if (!rm?.roomId || seen.has(rm.roomId) || !prices[rm.roomId]) continue;  // unknown rooms aren't billed
      seen.add(rm.roomId);
      const q = quoteRoom(prices[rm.roomId], isNP, hours);
      const notes = [
        q.extraHours > 0 ? `4 hrs ${usd0(q.block)} + ${fmtHours(q.extraHours)} at ${usd0(q.hourly)}/hr` : "4-hour rate",
        isNP ? "non-profit rate" : null,
      ].filter(Boolean);
      lines.push({
        auto_key: `${AUTO_PREFIX}${d.date}:${rm.roomId}`,
        label: `${roomName(rm.roomId)} · ${fmtDay(d.date)} · ${fmtHours(hours)}`,
        unit_price: q.amount,
        note: notes.join(" · "),
      });
    }
  }
  return lines;
}
const usd0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });

/** Before staff approve, the room lines are the booking page estimate and follow the schedule. */
export const ESTIMATE_STATUSES = new Set(["pending", "pending_insurance", "needs_info", "under_review"]);

/**
 * Rebuild a booking's room-rental lines from its schedule and the price list.
 *
 * Automatic (no `force`): only while the booking is still an estimate, and
 * never over room pricing staff entered by hand. Once approved, the price
 * stays put — staff press Recalculate to change it. Payment not needed →
 * the automatic lines come off, whatever the status.
 *
 * `force` (the Recalculate button): replaces every room-rental line, hand-
 * entered ones included, with the price list's numbers.
 */
export async function syncRoomCharges(
  db: SupabaseClient, reservationId: string, opts: { force?: boolean; actorId?: string | null } = {},
): Promise<{ updated: boolean; total: number }> {
  const { data: r } = await db.from("reservations")
    .select("id, status, payload, is_non_profit, waived, rental_manual").eq("id", reservationId).maybeSingle();
  if (!r) return { updated: false, total: 0 };
  const clearAuto = () => db.from("reservation_charges").delete().eq("reservation_id", r.id).like("auto_key", `${AUTO_PREFIX}%`);

  if (readWaived(r.waived).payment) {
    await clearAuto();
    const days = ((r.payload as { days?: Day[] } | null)?.days ?? []) as Day[];
    await syncTieredAddons(db, r.id, days, true, opts.actorId ?? null);
    await syncRewardDiscount(db, r.id);
    return { updated: true, total: 0 };
  }

  if (!opts.force) {
    if (isClosedStatus(r.status) || !ESTIMATE_STATUSES.has(String(r.status ?? "")) || r.rental_manual) {
      return { updated: false, total: 0 };
    }
    // A room line staff typed in (e.g. before automatic pricing) means they're pricing by hand
    const { data: rentals } = await db.from("reservation_charges").select("auto_key").eq("reservation_id", r.id).eq("kind", "rental");
    if ((rentals ?? []).some((c) => !isAutoRental(c.auto_key))) {
      await db.from("reservations").update({ rental_manual: true }).eq("id", r.id);
      return { updated: false, total: 0 };
    }
  }

  const prices = await readRoomPrices(db).catch(() => DEFAULT_PRICES);
  const days = ((r.payload as { days?: Day[] } | null)?.days ?? []) as Day[];
  const lines = rentalLines(days, prices, !!r.is_non_profit);

  if (opts.force) await db.from("reservation_charges").delete().eq("reservation_id", r.id).eq("kind", "rental");
  else await clearAuto();
  if (lines.length) {
    const { error } = await db.from("reservation_charges").insert(lines.map((l) => ({
      reservation_id: r.id, kind: "rental", label: l.label, unit_price: l.unit_price, quantity: 1,
      note: l.note, auto_key: l.auto_key, added_by: opts.actorId ?? null, added_by_staff: false,
    })));
    // 23505: a sync running at the same moment already wrote these lines (unique index)
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  if (r.rental_manual) await db.from("reservations").update({ rental_manual: false }).eq("id", r.id);
  await syncTieredAddons(db, r.id, days, false, opts.actorId ?? null);
  await syncRewardDiscount(db, r.id);
  return { updated: true, total: lines.reduce((s, l) => s + l.unit_price, 0) };
}

const CHURCH_NOTE = "No charge — church use";

/**
 * Payment needed ↔ not needed changed: plain add-ons go to $0 (kept on the
 * booking so the team knows what to set up) or back to catalog price.
 */
export async function repriceAddonsForWaiver(db: SupabaseClient, reservationId: string, free: boolean) {
  const { data: lines } = await db.from("reservation_charges").select("id, addon_id, note, unit_price")
    .eq("reservation_id", reservationId).eq("kind", "addon").is("auto_key", null).not("addon_id", "is", null);
  if (!lines?.length) return;
  if (free) {
    await db.from("reservation_charges").update({ unit_price: 0, note: CHURCH_NOTE }).in("id", lines.map((l) => l.id));
    return;
  }
  const back = lines.filter((l) => l.note === CHURCH_NOTE);
  if (!back.length) return;
  const { data: catalog } = await db.from("bx_addons").select("id, price").in("id", [...new Set(back.map((l) => l.addon_id as string))]);
  for (const l of back) {
    const price = (catalog ?? []).find((c) => c.id === l.addon_id)?.price;
    if (price != null) await db.from("reservation_charges").update({ unit_price: Number(price), note: null }).eq("id", l.id);
  }
}

/** Re-price hour-tiered add-ons (Complete AV package) for the current schedule. */
async function syncTieredAddons(db: SupabaseClient, reservationId: string, days: Day[], free: boolean, actorId: string | null) {
  const { data: existing } = await db.from("reservation_charges").select("addon_id, auto_key")
    .eq("reservation_id", reservationId).like("auto_key", `${TIER_PREFIX}%`);
  const ids = [...new Set((existing ?? []).map((c) => c.addon_id as string).filter(Boolean))];
  if (!ids.length) return;
  const { data: addons } = await db.from("bx_addons").select("*").in("id", ids);
  const rows = ((addons ?? []) as AddonWithRules[]).filter(isTiered).flatMap((a) =>
    addonLines(a, 1, days, free).map((l) => ({
      reservation_id: reservationId, kind: "addon", addon_id: a.id, label: l.label, unit_price: l.unit_price,
      quantity: l.quantity, note: l.note, auto_key: l.auto_key, added_by: actorId, added_by_staff: false,
    })));
  await db.from("reservation_charges").delete().eq("reservation_id", reservationId).like("auto_key", `${TIER_PREFIX}%`);
  if (rows.length) {
    const { error } = await db.from("reservation_charges").insert(rows);
    if (error && error.code !== "23505") throw new Error(error.message);
  }
}

/**
 * Add catalog add-ons to a booking at catalog price, following each add-on's
 * room and hour rules. Returns how many lines were added and any that didn't fit.
 */
export async function addAddons(
  db: SupabaseClient, reservationId: string,
  picks: { id: string; qty: number }[],
  opts: { actorId: string | null; staff: boolean; includeHidden?: boolean; unitPrice?: number },
): Promise<{ added: string[]; skipped: string[] }> {
  if (!picks.length) return { added: [], skipped: [] };
  const [{ data: r }, { data: catalog }] = await Promise.all([
    db.from("reservations").select("id, payload, waived").eq("id", reservationId).maybeSingle(),
    db.from("bx_addons").select("*").in("id", picks.map((p) => p.id)),
  ]);
  if (!r) return { added: [], skipped: [] };
  const days = ((r.payload as { days?: Day[] } | null)?.days ?? []) as Day[];
  const free = readWaived(r.waived).payment;
  const added: string[] = [], skipped: string[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const p of picks) {
    const a = ((catalog ?? []) as (AddonWithRules & { active: boolean })[]).find((c) => c.id === p.id);
    if (!a || (!a.active && !opts.includeHidden)) continue;
    let lines = addonLines(a, p.qty, days, free);
    if (!lines.length) { skipped.push(a.name); continue; }
    if (opts.unitPrice !== undefined && !isTiered(a)) lines = lines.map((l) => ({ ...l, unit_price: opts.unitPrice! }));
    added.push(a.name);
    rows.push(...lines.map((l) => ({
      reservation_id: r.id, kind: "addon", addon_id: a.id, label: l.label, unit_price: l.unit_price, quantity: l.quantity,
      note: l.note, auto_key: l.auto_key, added_by: opts.actorId, added_by_staff: opts.staff,
    })));
  }
  if (rows.length) {
    // A tiered add-on already on the booking → its existing day lines win (unique index)
    const { error } = await db.from("reservation_charges").insert(rows);
    if (error) throw new Error(error.code === "23505" ? "That add-on is already on this booking." : error.message);
  }
  return { added, skipped };
}

export const isAutoRental = (autoKey: unknown) => typeof autoKey === "string" && autoKey.startsWith(AUTO_PREFIX);
