import { NextRequest, NextResponse, after } from "next/server";
import { adminClient, STAFF_ROLES } from "@/lib/event-map";
import { rateLimit, clientIp, HOUR } from "@/lib/rate-limit";
import { RATING_KEYS, issueReward, needsFollowup, readSurveySettings, type RatingKey } from "@/lib/survey";
import { sendEmail, brandedEmailHtml, escHtml, escMultiline } from "@/lib/email";
import { ADMIN_EMAIL, SITE_URL } from "@/lib/site";

type Params = { params: Promise<{ token: string }> };

const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};
const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 2000) : "");

// POST /api/survey/[token] — submit the post-event survey (no sign-in: the
// private link is the key). One submission per booking.
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ error: "This survey link isn't valid." }, { status: 404 });
  const limited = await rateLimit("survey", [{ key: clientIp(req), max: 30, windowSec: HOUR }]);
  if (limited) return limited;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nps = int(b.nps, 0, 10);
  if (nps === null) return NextResponse.json({ error: "Please choose a number from 0 to 10." }, { status: 400 });
  const ratings: Partial<Record<RatingKey, number>> = {};
  const rin = (b.ratings ?? {}) as Record<string, unknown>;
  for (const k of RATING_KEYS) { const v = int(rin[k], 1, 5); if (v !== null) ratings[k] = v; }
  const ease = int(b.ease, 1, 5);

  const db = adminClient();
  const { data: s } = await db.from("bx_surveys").select("id, reservation_id, email, submitted_at").eq("token", token).maybeSingle();
  if (!s) return NextResponse.json({ error: "This survey link isn't valid." }, { status: 404 });
  const settings = await readSurveySettings(db);
  const { data: res } = await db.from("reservations").select("id, booking_number, event_name, contact_name, contact_email, user_id, waived").eq("id", s.reservation_id).maybeSingle();
  const noPayment = !!(res?.waived as { payment?: boolean } | null)?.payment;

  if (s.submitted_at) {
    // Already answered — show the same thank-you again
    const { data: rw } = await db.from("bx_rewards").select("percent, expires_at").eq("source_survey_id", s.id).maybeSingle();
    return NextResponse.json({ ok: true, already: true, reward: rw, googleReviewUrl: settings.googleReviewUrl, reservationId: s.reservation_id });
  }

  const followup = needsFollowup({ nps, ratings, ease });
  const { data: updated, error } = await db.from("bx_surveys").update({
    submitted_at: new Date().toISOString(), nps, reason: text(b.reason) || null, ratings, ease,
    improve: text(b.improve) || null, share_ok: b.share_ok === true, contact_ok: b.contact_ok !== false, followup_needed: followup,
  }).eq("id", s.id).is("submitted_at", null).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ ok: true, already: true, googleReviewUrl: settings.googleReviewUrl, reservationId: s.reservation_id });

  // The thank-you, whatever the answers
  const email = (s.email || res?.contact_email || "") as string;
  const reward = noPayment ? null : await issueReward(db, { surveyId: s.id, email, userId: (res?.user_id as string | null) ?? null, settings });

  // Close the loop: staff hear about low scores right away
  if (followup && res) {
    after(async () => {
      try {
        const who = (res.contact_name as string) || email;
        const ref = (res.booking_number as string) ?? res.id.slice(0, 8);
        const { data: staff } = await db.from("bx_user_roles").select("user_id").in("role", STAFF_ROLES as unknown as string[]);
        if (staff?.length) {
          await db.from("bx_notifications").insert(staff.map((r) => ({
            user_id: r.user_id, reservation_id: res.id, type: "survey_followup",
            title: `Follow up: ${who} scored us ${nps}/10`,
            body: `${res.event_name ?? "An event"} (${ref}). Please reach out within 2 business days — see Admin > Reports > Guest feedback.`,
          })));
        }
        const lines = [
          `<p style="margin:0 0 12px;"><strong>${escHtml(who)}</strong> answered the survey for <strong>${escHtml(res.event_name ?? "")}</strong> (${escHtml(ref)}).</p>`,
          `<p style="margin:0 0 8px;">Would recommend: <strong>${nps}/10</strong>${ease ? ` · Easy to plan: <strong>${ease}/5</strong>` : ""}</p>`,
          text(b.reason) ? `<p style="margin:0 0 8px;"><strong>Why:</strong> ${escMultiline(text(b.reason))}</p>` : "",
          text(b.improve) ? `<p style="margin:0 0 8px;"><strong>Do better:</strong> ${escMultiline(text(b.improve))}</p>` : "",
          `<p style="margin:12px 0 0;">${b.contact_ok === false ? "They asked not to be contacted." : `Please reach out within 2 business days: ${escHtml(email)}.`}</p>`,
        ].join("");
        await sendEmail({
          to: ADMIN_EMAIL, subject: `[BX] Survey follow-up needed — ${nps}/10 · ${ref}`,
          html: brandedEmailHtml({ headline: "A guest needs a follow-up", body: lines, ctaText: "Open Guest feedback", ctaUrl: `${SITE_URL}/admin/bx-reservations?tab=reports`, footnoteHtml: null }),
        });
      } catch (e) { console.error("[survey] follow-up alert failed:", (e as Error).message); }
    });
  }

  return NextResponse.json({ ok: true, reward, googleReviewUrl: settings.googleReviewUrl, reservationId: s.reservation_id });
}
