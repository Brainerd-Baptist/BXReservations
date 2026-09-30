"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Field, Input } from "@/app/components/ui/field";
import { useToast } from "@/app/components/Toast";

type S = { rewardPercent: number; rewardMonths: number; googleReviewUrl: string };

/** Settings → Survey & thank-you (Owner / System Admin). */
export default function SurveySettings() {
  const { toast } = useToast();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/survey-settings").then((r) => r.json()).then((d) => { if (live) setS(d as S); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!s) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/survey-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? `Error ${r.status}`);
      setS(d as S); toast("Survey settings saved.", "success");
    } catch (err) { toast((err as Error).message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="bx-glass rounded-xl p-5 space-y-4" aria-labelledby="ss-h">
      <div>
        <h2 id="ss-h" className="text-sm font-semibold text-parchment">Survey &amp; thank-you</h2>
        <p className="text-xs text-slate">The survey goes out the day after each event. Finishing it earns a discount on the next booking, whatever the answers, applied automatically.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Thank-you discount (%)" hint="0 turns the reward off. Changes apply to new rewards.">
          <Input type="number" min={0} max={50} step={1} value={s.rewardPercent} onChange={(e) => setS({ ...s, rewardPercent: Number(e.target.value) })} />
        </Field>
        <Field label="Good for (months)">
          <Input type="number" min={1} max={60} step={1} value={s.rewardMonths} onChange={(e) => setS({ ...s, rewardMonths: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Google review link" hint="From your Google Business Profile: Ask for reviews → copy link. Shown to everyone after the survey, never tied to the discount (Google's rules).">
        <Input type="url" inputMode="url" placeholder="https://g.page/r/…/review" value={s.googleReviewUrl} onChange={(e) => setS({ ...s, googleReviewUrl: e.target.value })} />
      </Field>
      <div className="flex justify-end"><Button type="submit" size="sm" loading={busy}>Save</Button></div>
    </form>
  );
}
