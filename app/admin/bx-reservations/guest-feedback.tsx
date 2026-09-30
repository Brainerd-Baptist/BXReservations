"use client";

import { useCallback, useEffect, useState } from "react";
import LoadError from "@/app/components/load-error";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/Toast";
import { RATING_KEYS, RATING_LABELS } from "@/lib/survey-labels";
import type { FeedbackData, FeedbackRow } from "@/app/api/admin/feedback/route";

const SHORT: Record<string, string> = { communication: "Communication", cleanliness: "Clean & ready", setup: "Setup as asked", arrival: "Arrival & parking", value: "Value" };
const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Reports → Guest feedback: recommend score, ratings, comments and follow-ups. */
export default function GuestFeedback() {
  const { toast } = useToast();
  const [days, setDays] = useState<30 | 90 | 365>(90);
  const [data, setData] = useState<FeedbackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    try {
      const r = await fetch(`/api/admin/feedback?days=${d}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
      setData(j as FeedbackData); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { queueMicrotask(() => load(days)); }, [days, load]);

  async function markDone(row: FeedbackRow) {
    setBusy(row.id);
    try {
      const r = await fetch(`/api/admin/feedback/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: notes[row.id] ?? "" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
      toast("Marked as followed up.", "success"); await load(days);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(null); }
  }

  const rate = data && data.sent ? Math.round((data.answeredOfSent / data.sent) * 100) : null;

  return (
    <section className="bx-glass rounded-xl p-5 space-y-5" aria-labelledby="fb-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="fb-h" className="text-sm font-semibold text-parchment">Guest feedback</h2>
          <p className="text-xs text-slate">From the survey sent the day after each event. Follow up on low scores within 2 business days.</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Period">
          {([30, 90, 365] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
              className={`px-3 py-1.5 min-h-9 rounded-full text-xs font-medium border ${days === d ? "border-transparent" : "border-parchment/15 text-slate"}`}
              style={days === d ? { background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" } : undefined}>
              {d === 365 ? "1 year" : `${d} days`}
            </button>
          ))}
        </div>
      </div>

      {error && <LoadError what="guest feedback" message={error} onRetry={() => load(days)} />}
      {!error && !data && <p className="text-sm text-slate" aria-busy="true">Loading…</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bx-well rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-slate">Recommend score (NPS)</p>
              <p className="text-3xl font-bold tabular text-parchment">{data.nps === null ? "—" : data.nps > 0 ? `+${data.nps}` : data.nps}</p>
              <p className="text-xs text-slate">{data.promoters} promoter{data.promoters === 1 ? "" : "s"} · {data.passives} passive · {data.detractors} detractor{data.detractors === 1 ? "" : "s"}</p>
            </div>
            <div className="bx-well rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-slate">Responses</p>
              <p className="text-3xl font-bold tabular text-parchment">{data.responses}</p>
              <p className="text-xs text-slate">{rate === null ? "No surveys sent yet" : `${rate}% answered of ${data.sent} emailed`}</p>
            </div>
            <div className="bx-well rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-slate">Easy to plan</p>
              <p className="text-3xl font-bold tabular text-parchment">{data.ease === null ? "—" : `${data.ease}/5`}</p>
              <p className="text-xs text-slate">&ldquo;The BX made it easy&rdquo;</p>
            </div>
          </div>
          <p className="text-xs text-slate">NPS runs from −100 to +100: the % who&apos;d recommend you (9–10) minus the % who wouldn&apos;t (0–6). Above +50 is excellent.</p>

          {Object.keys(data.averages).length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {RATING_KEYS.filter((k) => data.averages[k] !== undefined).map((k) => (
                <li key={k} className="flex items-center justify-between gap-3 text-sm bx-well rounded-lg px-3 py-2" title={RATING_LABELS[k]}>
                  <span className="text-slate">{SHORT[k]}</span>
                  <span className="tabular text-parchment font-semibold">{data.averages[k]} ★</span>
                </li>
              ))}
            </ul>
          )}

          {data.openFollowups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--tone-orange-fg)" }}>Needs a follow-up ({data.openFollowups.length})</p>
              {data.openFollowups.map((f) => (
                <div key={f.id} className="bx-tone-orange border rounded-xl p-3 space-y-2 text-sm">
                  <p><strong>{f.name ?? f.email}</strong> · {f.eventName} · {f.nps}/10 · {when(f.submittedAt)}{!f.contactOk && " · asked not to be contacted"}</p>
                  {f.reason && <p>&ldquo;{f.reason}&rdquo;</p>}
                  {f.improve && <p><span className="font-semibold">Do better:</span> {f.improve}</p>}
                  {f.email && f.contactOk && <p><a className="underline" href={`mailto:${f.email}`}>{f.email}</a></p>}
                  <div className="flex flex-wrap gap-2 items-center">
                    <input className="bx-input bx-input--sm flex-1 min-w-[12rem]" aria-label="What you did" placeholder="What you did (e.g. called, offered a credit)"
                      value={notes[f.id] ?? ""} onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })} />
                    <Button size="sm" loading={busy === f.id} onClick={() => markDone(f)}>Mark followed up</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate">Recent answers</p>
            {data.recent.length === 0 && <p className="text-sm text-slate">No answers in this period yet. Surveys go out the day after each event.</p>}
            <ul className="space-y-2">
              {data.recent.map((r) => (
                <li key={r.id} className="bx-well rounded-xl p-3 text-sm space-y-1">
                  <p className="flex flex-wrap gap-x-2 text-parchment">
                    <strong className="tabular">{r.nps}/10</strong><span>{r.name ?? r.email}</span><span className="text-slate">· {r.eventName} · {when(r.submittedAt)}</span>
                    {r.shareOk && <span className="bx-tone-green border rounded-full px-2 text-xs">OK to share</span>}
                    {r.followedUpAt && <span className="text-xs text-slate">· followed up by {r.followedUpBy}</span>}
                  </p>
                  {r.reason && <p className="text-slate">&ldquo;{r.reason}&rdquo;</p>}
                  {r.improve && <p className="text-slate"><span className="text-parchment">Do better:</span> {r.improve}</p>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
