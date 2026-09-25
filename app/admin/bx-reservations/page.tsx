"use client";
import { useState, useEffect } from "react";
import { BlackoutRule, ruleDescription } from "@/lib/blackouts";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status = "Requested" | "Proposal Sent" | "Deposit Received" | "Confirmed" | "Declined";

interface Request {
  id: string;
  name: string;
  org: string;
  email: string;
  room: string;
  date: string;
  event: string;
  guests: number;
  setup: string;
  estimate: number;
  status: Status;
  submitted: string;
  nonProfit: boolean;
  avNeeded: boolean;
  tablecloths: number;
  flexible: boolean; // is the blocked slot a soft block?
}

// ─── Mock data ─────────────────────────────────────────────────────────────────
const INITIAL_REQUESTS: Request[] = [
  {
    id: "BX-IS117",
    name: "Michelle Smith",
    org: "Isaiah 117 House at Chambliss Center",
    email: "michelle.smith@isaiah117house.com",
    room: "The Crossing",
    date: "2026-10-20",
    event: "Isaiah 117 House Luncheon & Dinner",
    guests: 250,
    setup: "Banquet/Rounds",
    estimate: 750,
    status: "Requested",
    submitted: "2026-03-24",
    nonProfit: true,
    avNeeded: true,
    tablecloths: 32,
    flexible: false,
  },
  {
    id: "BX-HCGOV",
    name: "LaDarius Price",
    org: "Hamilton County Government",
    email: "lprice@hamiltontn.gov",
    room: "The Crossing",
    date: "2026-10-29",
    event: "Mental Health Summit",
    guests: 75,
    setup: "Banquet/Rounds",
    estimate: 900,
    status: "Proposal Sent",
    submitted: "2026-08-14",
    nonProfit: false,
    avNeeded: true,
    tablecloths: 0,
    flexible: false,
  },
  {
    id: "BX-YMCA1",
    name: "Susan Moriarty",
    org: "YMCA Center for Civic Engagement",
    email: "smoriarty@ymcamidtn.org",
    room: "The Crossing",
    date: "2026-10-22",
    event: "Middle School Model UN",
    guests: 200,
    setup: "Theater",
    estimate: 750,
    status: "Deposit Received",
    submitted: "2026-05-27",
    nonProfit: true,
    avNeeded: true,
    tablecloths: 0,
    flexible: false,
  },
  {
    id: "BX-PERRL",
    name: "Kelly Perrel",
    org: "",
    email: "Kperrel@gmail.com",
    room: "CrossView",
    date: "2026-10-03",
    event: "Jonckheere Baby Shower",
    guests: 45,
    setup: "Banquet/Rounds",
    estimate: 250,
    status: "Confirmed",
    submitted: "2026-09-05",
    nonProfit: true,
    avNeeded: false,
    tablecloths: 0,
    flexible: false,
  },
  {
    id: "BX-TRUST",
    name: "Lindsey Gutierrez",
    org: "The Generosity Trust",
    email: "lindsey@thegenerositytrust.org",
    room: "CrossPointe A",
    date: "2026-10-22",
    event: "Faith Community Leadership Roundtable",
    guests: 25,
    setup: "Classroom",
    estimate: 200,
    status: "Declined",
    submitted: "2026-09-09",
    nonProfit: true,
    avNeeded: true,
    tablecloths: 0,
    flexible: false,
  },
]

// ─── Calendar data (combined staff view — real names + flex flags) ─────────────
const CALENDAR_EVENTS = [
  { date: "2026-10-03", room: "CrossView", label: "Perrel Baby Shower (Confirmed)", kind: "rental" as const },
  { date: "2026-10-06", room: "CrossPointe A", label: "City of Chattanooga — Team Training", kind: "rental" as const },
  { date: "2026-10-10", room: "The Crossing", label: "Breton Birthday Party (Inquiry)", kind: "rental" as const },
  { date: "2026-10-20", room: "The Crossing", label: "Isaiah 117 House Luncheon & Dinner (New)", kind: "rental" as const },
  { date: "2026-10-22", room: "The Crossing", label: "YMCA Model UN (Deposit In)", kind: "rental" as const },
  { date: "2026-10-22", room: "CrossPointe A", label: "Generosity Trust Roundtable (Declined)", kind: "declined" as const },
  { date: "2026-10-29", room: "The Crossing", label: "Hamilton Co. Mental Health Summit (Proposal Out)", kind: "rental" as const },
  { date: "2026-10-22", room: "The Loft", label: "Men's Bible Study (weekly — can flex)", kind: "flex" as const },
]



const STATUS_ORDER: Status[] = [
  "Requested",
  "Proposal Sent",
  "Deposit Received",
  "Confirmed",
  "Declined",
];

const STATUS_COLORS: Record<Status, string> = {
  Requested: "bg-amber-100 text-amber-800 border-amber-200",
  "Proposal Sent": "bg-blue-100 text-blue-800 border-blue-200",
  "Deposit Received": "bg-purple-100 text-purple-800 border-purple-200",
  Confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Declined: "bg-red-100 text-red-800 border-red-200",
};

export default function BxReservationsAdmin() {
  const [requests, setRequests] = useState<Request[]>(INITIAL_REQUESTS);
  const [filter, setFilter] = useState<Status | "All">("All");
  const [selected, setSelected] = useState<Request | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [tab, setTab] = useState<"requests" | "settings">("requests");

  // ── Blackout rules ────────────────────────────────────────────────────────
  const [blackouts, setBlackouts] = useState<BlackoutRule[]>([]);
  const [blackoutsLoading, setBlackoutsLoading] = useState(true);
  const [newRuleType, setNewRuleType] = useState<"dow" | "dow_slot" | "date">("dow");
  const [newDow, setNewDow] = useState(0);
  const [newSlot, setNewSlot] = useState("evening");
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/blackouts")
      .then(r => r.json())
      .then((data: BlackoutRule[]) => { setBlackouts(data); setBlackoutsLoading(false); })
      .catch(() => setBlackoutsLoading(false));
  }, []);

  async function addBlackout() {
    let data: Record<string, unknown> = {};
    if (newRuleType === "dow") data = { dow: newDow };
    else if (newRuleType === "dow_slot") data = { dow: newDow, slot: newSlot };
    else if (newRuleType === "date") data = { date: newDate };
    setSaving(true);
    const res = await fetch("/api/blackouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule_type: newRuleType, data, label: newLabel }),
    });
    if (res.ok) {
      const rule = await res.json() as BlackoutRule;
      setBlackouts(prev => [...prev, rule]);
      setNewLabel(""); setNewDate("");
    }
    setSaving(false);
  }

  async function removeBlackout(id: string) {
    await fetch("/api/blackouts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBlackouts(prev => prev.filter(r => r.id !== id));
  }

  const filtered =
    filter === "All" ? requests : requests.filter((r) => r.status === filter);

  const advance = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const idx = STATUS_ORDER.indexOf(r.status);
        const next = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 2)];
        const updated = { ...r, status: next };
        if (selected?.id === id) setSelected(updated);
        return updated;
      })
    );
  };

  const decline = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, status: "Declined" as Status };
        if (selected?.id === id) setSelected(updated);
        return updated;
      })
    );
  };

  // KPIs
  const pending = requests.filter((r) => r.status === "Requested").length;
  const awaitingDeposit = requests.filter((r) => r.status === "Proposal Sent").length;
  const confirmedThisMonth = requests.filter(
    (r) => r.status === "Confirmed" && r.date.startsWith("2026-10")
  ).length;
  const revenue = requests
    .filter((r) => r.status === "Confirmed" || r.status === "Deposit Received")
    .reduce((s, r) => s + r.estimate, 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top bar */}
      <header className="bg-[var(--bbc-navy)] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <p className="text-xs opacity-50 font-semibold uppercase tracking-widest">BX Community Center</p>
          <h1 className="text-lg font-bold">Reservations</h1>
        </div>
        <button
          className="text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity border border-white/20 rounded-lg px-3 py-1.5"
          onClick={() => setCalOpen((v) => !v)}
        >
          {calOpen ? "Hide" : "Show"} Calendar ↗
        </button>
      </header>

      {/* Tab nav */}
      <div className="border-b border-white/10 bg-[var(--bbc-navy)]">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {(["requests", "settings"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 ${
                tab === t
                  ? "border-white text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {t === "requests" ? "Requests" : "Settings"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: queue / settings */}
        <div className="space-y-5">
          {tab === "settings" && (
            <BlackoutSettings
              rules={blackouts}
              loading={blackoutsLoading}
              newRuleType={newRuleType} setNewRuleType={setNewRuleType}
              newDow={newDow} setNewDow={setNewDow}
              newSlot={newSlot} setNewSlot={setNewSlot}
              newDate={newDate} setNewDate={setNewDate}
              newLabel={newLabel} setNewLabel={setNewLabel}
              saving={saving}
              onAdd={addBlackout}
              onRemove={removeBlackout}
            />
          )}
          {tab === "requests" && (<>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Pending Review" value={String(pending)} color="text-amber-600" />
            <KPI label="Awaiting Deposit" value={String(awaitingDeposit)} color="text-blue-600" />
            <KPI label="Confirmed (Oct)" value={String(confirmedThisMonth)} color="text-emerald-600" />
            <KPI label="Revenue Pipeline" value={`$${revenue.toLocaleString()}`} color="text-[var(--bbc-blue)]" />
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {(["All", ...STATUS_ORDER] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  filter === s
                    ? "bg-[var(--bbc-navy)] text-white border-[var(--bbc-navy)]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {s}
                {s !== "All" && (
                  <span className="ml-1.5 opacity-60">
                    {requests.filter((r) => r.status === s).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Request cards */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                No requests with this status
              </div>
            )}
            {filtered.map((req) => (
              <div
                key={req.id}
                className={`bg-white rounded-xl border border-gray-100 p-4 cursor-pointer transition-all hover:shadow-md ${
                  selected?.id === req.id ? "ring-2 ring-[var(--bbc-blue)]" : ""
                }`}
                onClick={() => setSelected(selected?.id === req.id ? null : req)}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-gray-900 text-sm">{req.name}</p>
                      {req.org && <p className="text-xs text-gray-400">· {req.org}</p>}
                      {req.flexible && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ Soft block
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">{req.event}</span> — {req.room} · {req.date}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{req.id} · Submitted {req.submitted}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-sm text-gray-900">${req.estimate.toLocaleString()}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[req.status]}`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {selected?.id === req.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <Detail label="Email" value={req.email} />
                      <Detail label="Guests" value={String(req.guests)} />
                      <Detail label="Setup" value={req.setup} />
                      <Detail label="Rate type" value={req.nonProfit ? "Non-profit" : "Standard"} />
                      <Detail label="A/V" value={req.avNeeded ? "Yes" : "No"} />
                      <Detail label="Tablecloths" value={String(req.tablecloths)} />
                    </div>

                    {/* Status pipeline */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Pipeline</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {STATUS_ORDER.filter((s) => s !== "Declined").map((s, i) => {
                          const idx = STATUS_ORDER.indexOf(req.status);
                          const sIdx = STATUS_ORDER.indexOf(s);
                          return (
                            <div key={s} className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  req.status === "Declined"
                                    ? "bg-gray-100 text-gray-400"
                                    : sIdx < idx
                                    ? "bg-emerald-100 text-emerald-700"
                                    : sIdx === idx
                                    ? "bg-[var(--bbc-navy)] text-white"
                                    : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                {s}
                              </span>
                              {i < STATUS_ORDER.length - 2 && (
                                <span className="text-gray-300 text-xs">→</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    {req.status !== "Confirmed" && req.status !== "Declined" && (
                      <div className="flex gap-3 flex-wrap">
                        <button
                          className="btn-primary text-sm"
                          onClick={(e) => { e.stopPropagation(); advance(req.id); }}
                        >
                          Advance →{" "}
                          {STATUS_ORDER[Math.min(STATUS_ORDER.indexOf(req.status) + 1, STATUS_ORDER.length - 2)]}
                        </button>
                        <button
                          className="btn-outline text-sm border-red-200 text-red-600 hover:border-red-400"
                          onClick={(e) => { e.stopPropagation(); decline(req.id); }}
                        >
                          Decline
                        </button>
                        <button
                          className="btn-outline text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Request Info
                        </button>
                      </div>
                    )}
                    {req.status === "Confirmed" && (
                      <p className="text-xs font-semibold text-emerald-600">✓ Confirmed — no action needed</p>
                    )}
                    {req.status === "Declined" && (
                      <p className="text-xs text-gray-400">This request was declined.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          </>)}
        </div>

        {/* Right: Calendar sidebar */}
        <div className={`${calOpen ? "block" : "hidden lg:block"}`}>
          <div className="sticky top-24 bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Combined Calendar</p>
              <p className="text-xs text-gray-400">Oct – Nov 2026</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Staff view — shows real event names and flex-block flags. Never visible to the public.
            </p>

            <div className="space-y-2">
              {CALENDAR_EVENTS.sort((a, b) => a.date.localeCompare(b.date)).map((ev, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-14">
                    <p className="text-xs font-bold text-gray-700">{ev.date.slice(5)}</p>
                    <p className="text-xs text-gray-400">{ev.room}</p>
                  </div>
                  <div
                    className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium leading-snug border ${
                      ev.kind === "rental"
                        ? "bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--bbc-navy)]"
                        : ev.kind === "flex"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-gray-50 border-gray-200 text-gray-400 line-through"
                    }`}
                  >
                    {ev.kind === "flex" && <span className="mr-1">⟳</span>}
                    {ev.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-gray-100 space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Legend</p>
              <LegendItem color="bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--bbc-navy)]" label="Rental / confirmed event" />
              <LegendItem color="bg-amber-50 border-amber-200 text-amber-800" label="⟳ Standing use · may flex" />
              <LegendItem color="bg-gray-50 border-gray-200 text-gray-400" label="Declined" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded px-2 py-0.5 text-xs border ${color}`}>Sample</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// ─── Blackout Settings panel ───────────────────────────────────────────────────
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS = [
  { value: "morning",   label: "Morning (8a–12p)" },
  { value: "afternoon", label: "Afternoon (12p–5p)" },
  { value: "evening",   label: "Evening (5p–10p)" },
];

function BlackoutSettings({
  rules, loading,
  newRuleType, setNewRuleType,
  newDow, setNewDow,
  newSlot, setNewSlot,
  newDate, setNewDate,
  newLabel, setNewLabel,
  saving, onAdd, onRemove,
}: {
  rules: BlackoutRule[];
  loading: boolean;
  newRuleType: "dow" | "dow_slot" | "date"; setNewRuleType: (v: "dow" | "dow_slot" | "date") => void;
  newDow: number; setNewDow: (v: number) => void;
  newSlot: string; setNewSlot: (v: string) => void;
  newDate: string; setNewDate: (v: string) => void;
  newLabel: string; setNewLabel: (v: string) => void;
  saving: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Blackout Rules</h2>
        <p className="text-sm text-gray-500 mt-1">
          Dates and times blocked on the public reservation form. PCO calendar is unaffected.
        </p>
      </div>

      {/* Current rules */}
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {loading && (
          <p className="px-5 py-4 text-sm text-gray-400">Loading…</p>
        )}
        {!loading && rules.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-400">No blackout rules yet.</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{rule.label || ruleDescription(rule)}</p>
              {rule.label && (
                <p className="text-xs text-gray-400">{ruleDescription(rule)}</p>
              )}
            </div>
            <button
              onClick={() => onRemove(rule.id)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold flex-shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Add new rule */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Add a rule</p>

        {/* Rule type */}
        <div className="flex gap-2 flex-wrap">
          {([
            { value: "dow",      label: "Block whole day (weekly)" },
            { value: "dow_slot", label: "Block time slot (weekly)" },
            { value: "date",     label: "Block specific date" },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setNewRuleType(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                newRuleType === opt.value
                  ? "bg-[#00205B] text-white border-[#00205B]"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Day of week picker */}
          {(newRuleType === "dow" || newRuleType === "dow_slot") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Day of week</label>
              <select
                value={newDow}
                onChange={e => setNewDow(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {DOW_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Slot picker */}
          {newRuleType === "dow_slot" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Time slot</label>
              <select
                value={newSlot}
                onChange={e => setNewSlot(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {SLOT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date picker */}
          {newRuleType === "date" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {/* Label */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Label <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Christmas, Church Night…"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={onAdd}
            disabled={saving || (newRuleType === "date" && !newDate)}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
