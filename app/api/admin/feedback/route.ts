import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { RATING_KEYS, npsOf, type RatingKey } from "@/lib/survey";

export interface FeedbackRow {
  id: string; reservationId: string; bookingNumber: string | null; eventName: string | null; name: string | null; email: string | null;
  submittedAt: string; nps: number; reason: string | null; improve: string | null; ratings: Partial<Record<RatingKey, number>>; ease: number | null;
  shareOk: boolean; contactOk: boolean; followupNeeded: boolean; followedUpAt: string | null; followedUpBy: string | null; followupNote: string | null;
}
export interface FeedbackData {
  days: number; sent: number; answeredOfSent: number; responses: number; nps: number | null;
  promoters: number; passives: number; detractors: number;
  averages: Partial<Record<RatingKey, number>>; ease: number | null;
  openFollowups: FeedbackRow[]; recent: FeedbackRow[];
}

// GET /api/admin/feedback?days=90 — guest survey results (staff)
export async function GET(req: Request) {
  const denied = await requireStaff();
  if (denied) return denied;
  const n = Number(new URL(req.url).searchParams.get("days"));
  const days = [30, 90, 365].includes(n) ? n : 90;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = adminClient();
  const [{ data: rows, error }, { data: sentRows }, { data: open }] = await Promise.all([
    db.from("bx_surveys").select("*, reservations(booking_number, event_name, contact_name, contact_email)").not("submitted_at", "is", null).gte("submitted_at", since).order("submitted_at", { ascending: false }).limit(500),
    db.from("bx_surveys").select("id, submitted_at").gte("sent_at", since).limit(2000),
    db.from("bx_surveys").select("*, reservations(booking_number, event_name, contact_name, contact_email)").eq("followup_needed", true).is("followed_up_at", null).not("submitted_at", "is", null).order("submitted_at").limit(50),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const toRow = (r: Record<string, unknown>): FeedbackRow => {
    const res = (Array.isArray(r.reservations) ? r.reservations[0] : r.reservations) as Record<string, string | null> | null;
    return {
      id: r.id as string, reservationId: r.reservation_id as string, bookingNumber: res?.booking_number ?? null, eventName: res?.event_name ?? null,
      name: res?.contact_name ?? null, email: (res?.contact_email as string | null) ?? (r.email as string | null),
      submittedAt: r.submitted_at as string, nps: r.nps as number, reason: r.reason as string | null, improve: r.improve as string | null,
      ratings: (r.ratings ?? {}) as Partial<Record<RatingKey, number>>, ease: (r.ease as number | null) ?? null,
      shareOk: !!r.share_ok, contactOk: r.contact_ok !== false, followupNeeded: !!r.followup_needed,
      followedUpAt: (r.followed_up_at as string | null) ?? null, followedUpBy: (r.followed_up_by as string | null) ?? null, followupNote: (r.followup_note as string | null) ?? null,
    };
  };
  const list = (rows ?? []).map(toRow);
  const scores = list.map((r) => r.nps);
  const averages: Partial<Record<RatingKey, number>> = {};
  for (const k of RATING_KEYS) {
    const v = list.map((r) => r.ratings[k]).filter((x): x is number => typeof x === "number");
    if (v.length) averages[k] = Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  }
  const easeV = list.map((r) => r.ease).filter((x): x is number => typeof x === "number");
  const data: FeedbackData = {
    // Response rate = answered ÷ emailed, over surveys emailed in this window
    days, sent: sentRows?.length ?? 0, answeredOfSent: (sentRows ?? []).filter((r) => r.submitted_at).length, responses: list.length, nps: npsOf(scores),
    promoters: scores.filter((s) => s >= 9).length, passives: scores.filter((s) => s >= 7 && s <= 8).length, detractors: scores.filter((s) => s <= 6).length,
    averages, ease: easeV.length ? Math.round((easeV.reduce((a, b) => a + b, 0) / easeV.length) * 10) / 10 : null,
    openFollowups: (open ?? []).map(toRow), recent: list.slice(0, 25),
  };
  return NextResponse.json(data);
}
