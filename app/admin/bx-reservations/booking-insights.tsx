"use client";

import { useCallback, useEffect, useState } from "react";
import LoadError from "@/app/components/load-error";
import type { InsightsData } from "@/app/api/admin/insights/route";

const SPEED_URL = "https://vercel.com/brainerdb/bx-reservations/speed-insights";
const ANALYTICS_URL = "https://vercel.com/brainerdb/bx-reservations/analytics";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

/**
 * Phase 6 — "measure before adding more polish". How many people start a
 * booking vs. finish one, and how many submissions fail. Page speed on real
 * phones lives in Vercel Speed Insights (linked).
 */
export default function BookingInsights() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setError(null);
    try {
      const r = await fetch(`/api/admin/insights?days=${d}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
      setData(j as InsightsData);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/insights?days=${days}`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`); return j as InsightsData; })
      .then((j) => { if (live) { setData(j); setError(null); } })
      .catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [days]);

  const f = data?.funnel;
  const steps = f ? [
    { label: "Opened Reserve", n: f.visits },
    { label: "Reached event details", n: f.details },
    { label: "Reached review", n: f.review },
    { label: "Pressed submit", n: f.attempted },
    { label: "Booking sent", n: f.booked },
  ] : [];
  const max = Math.max(1, ...steps.map((s) => s.n));
  const collecting = data?.collectingDays ?? 0;

  return (
    <section className="bx-glass rounded-xl p-5 space-y-5" aria-labelledby="insights-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="insights-h" className="text-sm font-semibold text-parchment">Booking funnel</h2>
          <p className="text-xs text-slate">
            {data?.firstEventAt
              ? `Measuring since ${new Date(data.firstEventAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${collecting} day${collecting === 1 ? "" : "s"}). Give it a month before deciding anything.`
              : "Starts counting with the next visit to Reserve."}
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Period">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${days === d ? "border-transparent" : "border-parchment/15 text-slate hover:text-parchment"}`}
              style={days === d ? { background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" } : undefined}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {error && <LoadError what="booking insights" message={error} onRetry={() => load(days)} />}
      {!error && !data && <p className="text-sm text-slate" aria-busy="true">Loading…</p>}

      {data && f && (
        <>
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={s.label} className="text-xs space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-slate">{s.label}</span>
                  <span className="tabular text-parchment font-semibold whitespace-nowrap">
                    {s.n}{i > 0 && <span className="text-slate font-normal"> · {pct(s.n, steps[0].n)}</span>}
                  </span>
                </div>
                <span className="block h-2 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(s.n ? 2 : 0, (s.n / max) * 100)}%`, background: i === steps.length - 1 ? "var(--bx-sage)" : "var(--bx-brass)" }} />
                </span>
              </li>
            ))}
          </ol>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Finish rate" value={pct(f.booked, f.visits)} sub="of people who opened Reserve" />
            <Stat label="Failed submissions" value={String(data.failures.total)}
              sub={data.failures.sessions ? `${data.failures.recovered} of ${data.failures.sessions} people retried and got through` : "none in this period"}
              warn={data.failures.total > 0} />
            <Stat label="Saved in the database" value={String(data.savedInDb)} sub="new bookings (includes staff-entered)" />
          </div>

          {data.failures.reasons.length > 0 && (
            <div className="bx-well rounded-xl p-4">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Why submissions failed</p>
              <ul className="space-y-1 text-xs">
                {data.failures.reasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-3"><span className="text-parchment break-words min-w-0">{r.reason}</span><span className="tabular text-slate">{r.count}</span></li>
                ))}
              </ul>
            </div>
          )}

          {data.signedInShare !== null && (
            <p className="text-xs text-slate">{Math.round(data.signedInShare * 100)}% of visitors were already signed in when they opened Reserve.</p>
          )}
        </>
      )}

      <div className="border-t border-parchment/10 pt-4 text-xs text-slate space-y-1">
        <p><span className="text-parchment font-medium">Page speed on real phones</span> — target: main content within 2.5s, taps answer within 0.2s.</p>
        <p>
          <a className="underline underline-offset-2 font-medium" style={{ color: "var(--bx-accent-text)" }} href={SPEED_URL} target="_blank" rel="noreferrer">Open Speed Insights ↗</a>
          <span aria-hidden="true"> · </span>
          <a className="underline underline-offset-2 font-medium" style={{ color: "var(--bx-accent-text)" }} href={ANALYTICS_URL} target="_blank" rel="noreferrer">Open page views ↗</a>
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="bx-well rounded-xl p-4">
      <p className="text-xs uppercase tracking-widest text-slate">{label}</p>
      <p className="text-2xl font-bold tabular" style={{ color: warn ? "var(--bx-clay)" : "var(--bx-parchment)" }}>{value}</p>
      <p className="text-xs text-slate">{sub}</p>
    </div>
  );
}
