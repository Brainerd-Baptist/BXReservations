"use client";
import { useState } from "react";

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

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: queue */}
        <div className="space-y-5">
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
