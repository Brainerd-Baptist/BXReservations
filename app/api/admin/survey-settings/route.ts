import { NextRequest, NextResponse } from "next/server";
import { requireSysadmin, requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { readSurveySettings } from "@/lib/survey";

// GET — survey thank-you settings (staff can read)
export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  return NextResponse.json(await readSurveySettings(adminClient()));
}

// PATCH { rewardPercent?, rewardMonths?, googleReviewUrl? } — Owner / System Admin
export async function PATCH(req: NextRequest) {
  const denied = await requireSysadmin();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { rewardPercent?: unknown; rewardMonths?: unknown; googleReviewUrl?: unknown };
  const rows: { key: string; value: string }[] = [];
  if (b.rewardPercent !== undefined) {
    const n = Number(b.rewardPercent);
    if (!Number.isFinite(n) || n < 0 || n > 50) return NextResponse.json({ error: "Reward must be 0–50%." }, { status: 400 });
    rows.push({ key: "survey_reward_percent", value: String(Math.round(n * 100) / 100) });
  }
  if (b.rewardMonths !== undefined) {
    const n = Math.round(Number(b.rewardMonths));
    if (!Number.isFinite(n) || n < 1 || n > 60) return NextResponse.json({ error: "Months must be 1–60." }, { status: 400 });
    rows.push({ key: "survey_reward_months", value: String(n) });
  }
  if (b.googleReviewUrl !== undefined) {
    const u = String(b.googleReviewUrl ?? "").trim();
    if (u && !/^https:\/\/[^\s"<>]+$/i.test(u)) return NextResponse.json({ error: "The Google link should start with https://" }, { status: 400 });
    rows.push({ key: "google_review_url", value: u });
  }
  if (!rows.length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const { error } = await adminClient().from("bx_settings").upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await readSurveySettings(adminClient()));
}
