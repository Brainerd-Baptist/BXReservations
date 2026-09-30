// Post-event guest survey and its thank-you reward.
// Modeled on the Net Promoter System (0–10 recommend + why + close the loop),
// Airbnb's category ratings, and Gartner's Customer Effort Score.
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { RATING_KEYS, type RatingKey } from "@/lib/survey-labels";
export { RATING_KEYS, RATING_LABELS, EASE_LABELS, type RatingKey } from "@/lib/survey-labels";

export interface SurveySettings { rewardPercent: number; rewardMonths: number; googleReviewUrl: string }

export async function readSurveySettings(db: SupabaseClient): Promise<SurveySettings> {
  const { data } = await db.from("bx_settings").select("key, value").in("key", ["survey_reward_percent", "survey_reward_months", "google_review_url"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value as string | undefined;
  const pct = Number(get("survey_reward_percent") ?? 10);
  const months = Number(get("survey_reward_months") ?? 12);
  const url = String(get("google_review_url") ?? "").trim();
  return {
    rewardPercent: Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 10,
    rewardMonths: Number.isFinite(months) && months > 0 ? Math.min(60, Math.round(months)) : 12,
    googleReviewUrl: /^https:\/\//i.test(url) ? url : "",
  };
}

type SurveyRow = { id: string; token: string; submitted_at: string | null; reminded_at: string | null; sent_at: string | null };

/**
 * The survey row for a booking, created on first use (one per booking).
 * `emailed: true` records that the thank-you email is going out now.
 */
export async function ensureSurvey(db: SupabaseClient, reservationId: string, email: string | null, opts: { emailed?: boolean } = {}): Promise<SurveyRow> {
  const cols = "id, token, submitted_at, reminded_at, sent_at";
  const find = async () => (await db.from("bx_surveys").select(cols).eq("reservation_id", reservationId).maybeSingle()).data as SurveyRow | null;
  let row = await find();
  if (!row) {
    const token = randomBytes(18).toString("base64url");
    const { data, error } = await db.from("bx_surveys")
      .insert({ reservation_id: reservationId, token, email: email?.toLowerCase() ?? null, sent_at: opts.emailed ? new Date().toISOString() : null })
      .select(cols).single();
    if (error) {
      // Someone else created it at the same moment — use theirs
      row = await find();
      if (!row) throw new Error(error.message);
    } else {
      return data as SurveyRow;
    }
  }
  if (opts.emailed && !row.sent_at) {
    const sent_at = new Date().toISOString();
    await db.from("bx_surveys").update({ sent_at }).eq("id", row.id);
    row = { ...row, sent_at };
  }
  return row;
}

/** Answers that deserve a personal follow-up (the "close the loop" rule). */
export function needsFollowup(a: { nps: number; ratings: Partial<Record<RatingKey, number>>; ease: number | null }): boolean {
  return a.nps <= 6 || Object.values(a.ratings).some((v) => typeof v === "number" && v <= 2) || (a.ease !== null && a.ease <= 2);
}

/** Net Promoter Score from 0–10 answers: % promoters (9–10) − % detractors (0–6). */
export function npsOf(scores: number[]): number | null {
  if (!scores.length) return null;
  const p = scores.filter((s) => s >= 9).length, d = scores.filter((s) => s <= 6).length;
  return Math.round(((p - d) / scores.length) * 100);
}

// ─── Thank-you reward ──────────────────────────────────────────────────────────

/** Give the survey thank-you (once per survey). Returns the reward or null when rewards are off. */
export async function issueReward(db: SupabaseClient, opts: { surveyId: string; email: string; userId: string | null; settings: SurveySettings }) {
  if (opts.settings.rewardPercent <= 0 || !opts.email) return null;
  const { data: already } = await db.from("bx_rewards").select("id, percent, expires_at").eq("source_survey_id", opts.surveyId).maybeSingle();
  if (already) return already;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + opts.settings.rewardMonths);
  const { data } = await db.from("bx_rewards").insert({
    email: opts.email.toLowerCase(), user_id: opts.userId, percent: opts.settings.rewardPercent,
    source_survey_id: opts.surveyId, expires_at: expires.toISOString(),
  }).select("id, percent, expires_at").single();
  return data;
}

/**
 * At booking time: attach the oldest unused, unexpired reward for this person.
 * Only for a signed-in account (by its id or its verified sign-in email), so
 * typing someone else's email on the form can't claim their reward.
 */
export async function attachRewardAtSubmit(db: SupabaseClient, reservationId: string, user: { id: string; email?: string | null } | null): Promise<void> {
  if (!user) return;
  const now = new Date().toISOString();
  const open = () => db.from("bx_rewards").select("id").is("redeemed_reservation_id", null).gt("expires_at", now).order("created_at").limit(1);
  let { data } = await open().eq("user_id", user.id);
  if (!data?.length && user.email) ({ data } = await open().eq("email", user.email.trim().toLowerCase()));
  const reward = data?.[0];
  if (!reward) return;
  // Claim it only if still free (two bookings at once can't both use it)
  const { data: claimed } = await db.from("bx_rewards").update({ redeemed_reservation_id: reservationId, redeemed_at: now })
    .eq("id", reward.id).is("redeemed_reservation_id", null).select("id");
  if (!claimed?.length) return;
  await db.from("reservations").update({ reward_id: reward.id }).eq("id", reservationId);
  await syncRewardDiscount(db, reservationId);
}

/** Give the reward back when its booking is cancelled or declined. */
export async function releaseReward(db: SupabaseClient, reservationId: string): Promise<void> {
  const { data: r } = await db.from("reservations").select("reward_id").eq("id", reservationId).maybeSingle();
  if (!r?.reward_id) return;
  await db.from("bx_rewards").update({ redeemed_reservation_id: null, redeemed_at: null }).eq("id", r.reward_id).eq("redeemed_reservation_id", reservationId);
  await db.from("reservations").update({ reward_id: null }).eq("id", reservationId);
  await db.from("reservation_charges").delete().eq("reservation_id", reservationId).eq("auto_key", "reward");
}

/**
 * Keep the "Survey thank-you" discount line equal to X% of the booking's
 * charges. Called whenever charges change. No reward, or payment not
 * needed → no line.
 */
export async function syncRewardDiscount(db: SupabaseClient, reservationId: string): Promise<void> {
  const { data: r } = await db.from("reservations").select("reward_id, waived").eq("id", reservationId).maybeSingle();
  await db.from("reservation_charges").delete().eq("reservation_id", reservationId).eq("auto_key", "reward");
  if (!r?.reward_id || (r.waived as { payment?: boolean } | null)?.payment) return;
  const { data: reward } = await db.from("bx_rewards").select("percent").eq("id", r.reward_id).maybeSingle();
  if (!reward) return;
  const { data: charges } = await db.from("reservation_charges").select("amount, kind").eq("reservation_id", reservationId);
  const base = (charges ?? []).filter((c) => c.kind !== "discount" && Number(c.amount) > 0).reduce((s, c) => s + Number(c.amount), 0);
  if (base <= 0) return;
  const pct = Number(reward.percent);
  const off = Math.round(base * pct) / 100;
  // The unique index keeps it to one line even if two updates race
  await db.from("reservation_charges").insert({
    reservation_id: reservationId, kind: "discount", label: `Survey thank-you (${pct % 1 ? pct : pct.toFixed(0)}% off)`,
    unit_price: -off, quantity: 1, note: "Applied automatically for completing a guest survey", added_by_staff: false, auto_key: "reward",
  });
}
