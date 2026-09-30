import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/event-map";
import { getBilling } from "@/lib/billing";
import { readSurveySettings } from "@/lib/survey";
import SurveyForm from "./survey-form";

export const metadata: Metadata = { title: "How was your event? — BX Reservations", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

// Post-event survey. The private link from the thank-you email is the key,
// so there's no sign-in step (every extra step costs answers).
export default async function SurveyPage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const db = adminClient();
  const { data: s } = await db.from("bx_surveys").select("id, reservation_id, submitted_at").eq("token", token).maybeSingle();
  if (!s) notFound();
  const [{ data: res }, settings, billing, { data: reward }] = await Promise.all([
    db.from("reservations").select("id, event_name, contact_name, waived").eq("id", s.reservation_id).maybeSingle(),
    readSurveySettings(db),
    getBilling(db, s.reservation_id).catch(() => null),
    db.from("bx_rewards").select("percent, expires_at").eq("source_survey_id", s.id).maybeSingle(),
  ]);
  if (!res) notFound();
  const first = String(res.contact_name ?? "").trim().split(/\s+/)[0] || "there";
  const hadCharges = (billing?.totals.charges ?? 0) > 0 && !(res.waived as { payment?: boolean } | null)?.payment;
  return (
    <div className="px-4 py-8">
      <SurveyForm
        token={token}
        firstName={first}
        eventName={(res.event_name as string) || "your event"}
        reservationId={res.id as string}
        askValue={hadCharges}
        rewardPercent={(res.waived as { payment?: boolean } | null)?.payment ? 0 : settings.rewardPercent}
        rewardMonths={settings.rewardMonths}
        googleReviewUrl={settings.googleReviewUrl}
        done={s.submitted_at ? { reward: reward ?? null } : null}
      />
    </div>
  );
}
