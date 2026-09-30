"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoadError from "@/app/components/load-error";
import StatusBadge from "@/app/components/ui/status-badge";
import { useToast } from "@/app/components/Toast";
import { fetchArray } from "@/lib/fetch-list";
import { formatYmd, isClosedStatus, daysFromToday } from "@/lib/dates";
import { usd } from "@/lib/billing";
import type { BillingRow } from "@/app/api/admin/billing/route";

type Filter = "outstanding" | "unpriced" | "paid" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "outstanding", label: "Balance due" },
  { key: "unpriced", label: "No charges yet" },
  { key: "paid", label: "Paid in full" },
  { key: "all", label: "All" },
];
const isOff = (s: string | null) => isClosedStatus(s) && s !== "completed" || ["declined", "expired"].includes(s ?? "");

/** Payment hub: what every booking owes, what's been paid, and reminders. */
export default function PaymentHub() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BillingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("outstanding");
  const [q, setQ] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchArray<BillingRow>("/api/admin/billing").then(setRows).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    let live = true;
    fetchArray<BillingRow>("/api/admin/billing")
      .then((d) => { if (live) setRows(d); })
      .catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, []);

  const active = useMemo(() => (rows ?? []).filter((r) => !isOff(r.status)), [rows]);
  const outstanding = active.filter((r) => r.balance > 0);
  const collected = (rows ?? []).reduce((s, r) => s + r.paid, 0);
  const owed = outstanding.reduce((s, r) => s + r.balance, 0);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (filter === "all" ? rows ?? [] : active)
      .filter((r) =>
        filter === "outstanding" ? r.balance > 0
        : filter === "unpriced" ? r.charges === 0
        : filter === "paid" ? r.charges > 0 && r.balance <= 0
        : true)
      .filter((r) => !needle || [r.booking_number, r.contact_name, r.contact_org, r.event_name].some((v) => (v ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999"));
  }, [rows, active, filter, q]);

  async function remind(r: BillingRow) {
    setSending(r.id);
    try {
      const res = await fetch(`/api/admin/reservations/${r.id}/remind`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send");
      toast(`Reminder sent to ${r.contact_email}.`, "success");
      setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, last_reminder_at: new Date().toISOString() } : x)));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(null);
    }
  }

  if (error) return <LoadError what="balances" message={error} onRetry={load} />;
  if (!rows) return <p className="p-8 text-center text-slate text-sm" aria-busy="true">Loading balances…</p>;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bx-tone-amber border rounded-xl p-4">
          <dt className="text-xs uppercase tracking-wide">Outstanding</dt>
          <dd className="text-2xl font-bold tabular">{usd(owed)}</dd>
          <dd className="text-xs mt-0.5">{outstanding.length} booking{outstanding.length === 1 ? "" : "s"} with a balance</dd>
        </div>
        <div className="bx-glass rounded-xl p-4">
          <dt className="text-xs uppercase tracking-wide text-slate">Collected</dt>
          <dd className="text-2xl font-bold tabular text-parchment">{usd(collected)}</dd>
        </div>
        <div className="bx-glass rounded-xl p-4">
          <dt className="text-xs uppercase tracking-wide text-slate">Not priced yet</dt>
          <dd className="text-2xl font-bold tabular text-parchment">{active.filter((r) => r.charges === 0).length}</dd>
          <dd className="text-xs text-slate mt-0.5">open bookings with no charges</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`bx-btn bx-btn--sm ${filter === f.key ? "bx-btn--primary" : "bx-btn--secondary"}`}>{f.label}</button>
          ))}
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, org, event…"
          aria-label="Search balances" className="bx-input bx-input--sm w-auto min-w-[14rem] ml-auto" />
      </div>

      <div className="bx-glass rounded-xl overflow-x-auto">
        {shown.length === 0 ? (
          <p className="p-8 text-center text-slate text-sm">
            {filter === "outstanding" ? "Nothing outstanding. 🎉" : "No bookings match."}
          </p>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-parchment/10 text-xs text-slate uppercase tracking-widest">
                <th className="text-left px-4 py-3">Booking</th>
                <th className="text-left px-4 py-3">Event date</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Reminder</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const away = r.event_date ? daysFromToday(r.event_date) : null;
                return (
                  <tr key={r.id} className="border-b border-parchment/5 align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/bx-reservations?open=${r.id}`} className="font-semibold text-parchment hover:text-[var(--bx-accent-text)]">
                        {r.event_name || "Untitled event"}
                      </Link>
                      <div className="text-xs text-slate">{r.contact_name}{r.contact_org ? ` · ${r.contact_org}` : ""}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate whitespace-nowrap">{r.booking_number}</span>
                        {r.status && <StatusBadge status={r.status} size="sm" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate whitespace-nowrap">
                      {r.event_date ? formatYmd(r.event_date) : "—"}
                      {away !== null && away >= 0 && away <= 30 && <div className={away <= 7 ? "font-semibold" : ""} style={away <= 7 ? { color: "var(--bx-clay)" } : undefined}>{away === 0 ? "today" : `in ${away} day${away === 1 ? "" : "s"}`}</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-parchment">{r.charges ? usd(r.charges) : <span className="text-slate">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular text-parchment">{usd(r.paid)}</td>
                    <td className="px-4 py-3 text-right tabular font-bold" style={{ color: r.balance > 0 ? "var(--tone-amber-fg)" : "var(--bx-parchment)" }}>
                      {r.balance < 0 ? `${usd(-r.balance)} credit` : usd(r.balance)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate whitespace-nowrap">
                      {r.last_reminder_at ? new Date(r.last_reminder_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.balance > 0 && r.contact_email && (
                        <button type="button" onClick={() => remind(r)} disabled={sending === r.id} className="bx-btn bx-btn--secondary bx-btn--sm">
                          {sending === r.id ? "Sending…" : "Send reminder"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate">
        Reminders also go out automatically before the event when a confirmed booking has a balance — change the timing under Settings → Automation.
      </p>
    </div>
  );
}
