"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { RATING_KEYS, RATING_LABELS, EASE_LABELS, type RatingKey } from "@/lib/survey-labels";

type Reward = { percent: number; expires_at: string } | null;

export default function SurveyForm(props: {
  token: string; firstName: string; eventName: string; reservationId: string; askValue: boolean;
  rewardPercent: number; rewardMonths: number; googleReviewUrl: string; done: { reward: Reward } | null;
}) {
  const [nps, setNps] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
  const [ease, setEase] = useState<number | null>(null);
  const [improve, setImprove] = useState("");
  const [shareOk, setShareOk] = useState(false);
  const [contactOk, setContactOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ reward: Reward } | null>(props.done);
  const keys = RATING_KEYS.filter((k) => k !== "value" || props.askValue);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nps === null) { setError("Please choose a number from 0 to 10 for the first question."); document.getElementById("q-nps")?.focus(); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/survey/${props.token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nps, reason, ratings, ease, improve, share_ok: shareOk, contact_ok: contactOk }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? "Something went wrong.");
      setDone({ reward: (d as { reward?: Reward }).reward ?? null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  if (done) {
    const exp = done.reward ? new Date(done.reward.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
    return (
      <div className="max-w-xl mx-auto bx-glass rounded-2xl p-6 sm:p-8 space-y-5 text-center" role="status">
        <h1 className="font-serif text-3xl text-parchment">Thank you, {props.firstName}!</h1>
        <p className="text-sm text-slate">Your answers go straight to the BX team, and we read every one.</p>
        {done.reward && (
          <div className="bx-tone-green border rounded-xl p-4 text-left">
            <p className="font-semibold">{Number(done.reward.percent)}% off your next booking</p>
            <p className="text-sm mt-1">It&apos;s saved to your BX account and comes off automatically the next time you book signed in with this email{exp ? `, through ${exp}` : ""}. Nothing to remember.</p>
          </div>
        )}
        {props.googleReviewUrl && (
          <div className="bx-well rounded-xl p-4 text-left space-y-2">
            <p className="text-sm text-parchment font-medium">Would you share your experience on Google?</p>
            <p className="text-xs text-slate">It helps other families and groups find the BX. It takes a minute.</p>
            <a href={props.googleReviewUrl} target="_blank" rel="noopener" className="bx-btn bx-btn--secondary bx-btn--md">Write a Google review ↗</a>
          </div>
        )}
        <a href={`/reserve?from=${props.reservationId}`} className="bx-btn bx-btn--primary bx-btn--md">Book again</a>
      </div>
    );
  }

  const chip = (on: boolean) => `min-h-11 rounded-lg border text-sm font-semibold transition-colors ${on ? "border-transparent" : "border-parchment/20 text-parchment hover:border-[var(--bx-brass)]"}`;
  const onStyle = { background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" };

  return (
    <form onSubmit={submit} className="max-w-xl mx-auto bx-glass rounded-2xl p-6 sm:p-8 space-y-8" noValidate>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-slate">About a minute</p>
        <h1 className="font-serif text-3xl text-parchment">How was {props.eventName}?</h1>
        <p className="text-sm text-slate">
          Hi {props.firstName} — thank you for gathering at the BX.
          {props.rewardPercent > 0 && <> As a thank-you for your answers, you&apos;ll get <strong className="text-parchment">{props.rewardPercent}% off your next booking</strong>.</>}
        </p>
      </header>

      <fieldset className="space-y-3">
        <legend id="q-nps" tabIndex={-1} className="text-base font-semibold text-parchment outline-none">
          1. How likely are you to recommend the BX to a friend or colleague? <span className="text-xs font-normal text-slate">(required)</span>
        </legend>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5" role="radiogroup" aria-labelledby="q-nps">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" role="radio" aria-checked={nps === n} aria-label={`${n} out of 10`} onClick={() => setNps(n)}
              className={chip(nps === n)} style={nps === n ? onStyle : undefined}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate"><span>0 — Not at all likely</span><span>10 — Extremely likely</span></div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-base font-semibold text-parchment">2. What&apos;s the main reason for your score?</span>
        <textarea className="bx-input w-full" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
      </label>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-parchment">3. How did we do? <span className="text-xs font-normal text-slate">(tap 1–5 stars; skip any)</span></legend>
        {keys.map((k) => (
          <div key={k} className="space-y-1.5">
            <p id={`r-${k}`} className="text-sm text-parchment">{RATING_LABELS[k]}</p>
            <div className="flex gap-1.5" role="radiogroup" aria-labelledby={`r-${k}`}>
              {[1, 2, 3, 4, 5].map((v) => {
                const on = (ratings[k] ?? 0) >= v;
                return (
                  <button key={v} type="button" role="radio" aria-checked={ratings[k] === v} aria-label={`${v} star${v > 1 ? "s" : ""}`}
                    onClick={() => setRatings({ ...ratings, [k]: ratings[k] === v ? undefined : v })}
                    className="min-h-11 min-w-11 rounded-lg text-2xl leading-none" style={{ color: on ? "var(--bx-brass)" : "color-mix(in srgb, var(--bx-slate) 45%, transparent)" }}>
                    {on ? "★" : "☆"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend id="q-ease" className="text-base font-semibold text-parchment">4. &ldquo;The BX made it easy to plan and host my event.&rdquo;</legend>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5" role="radiogroup" aria-labelledby="q-ease">
          {EASE_LABELS.map((label, i) => (
            <button key={label} type="button" role="radio" aria-checked={ease === i + 1} onClick={() => setEase(ease === i + 1 ? null : i + 1)}
              className={`${chip(ease === i + 1)} px-2 text-xs`} style={ease === i + 1 ? onStyle : undefined}>{label}</button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-base font-semibold text-parchment">5. What&apos;s one thing we could do better?</span>
        <textarea className="bx-input w-full" rows={3} maxLength={2000} value={improve} onChange={(e) => setImprove(e.target.value)} placeholder="Optional" />
      </label>

      <div className="space-y-2 text-sm text-parchment">
        <label className="flex items-start gap-3 min-h-11"><input type="checkbox" className="mt-1" checked={shareOk} onChange={(e) => setShareOk(e.target.checked)} />
          <span>You may share my comments on the BX website with my first name.</span></label>
        <label className="flex items-start gap-3 min-h-11"><input type="checkbox" className="mt-1" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} />
          <span>It&apos;s OK to contact me about my answers.</span></label>
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: "var(--bx-clay)" }}>{error}</p>}
      <Button type="submit" size="lg" block loading={busy}>Send my answers</Button>
    </form>
  );
}
