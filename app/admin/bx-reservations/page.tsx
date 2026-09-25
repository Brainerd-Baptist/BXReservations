"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") ?? "requests";
  const tab = ["requests", "users", "ministries", "settings"].includes(rawTab)
    ? (rawTab as "requests" | "users" | "ministries" | "settings")
    : "requests";
  function setTab(id: "requests" | "users" | "ministries" | "settings") {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "requests") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    router.replace(`/admin/bx-reservations?${params.toString()}`);
  }

  // ── Users tab state ──────────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = useState("");
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);

  // ── Ministries tab state ─────────────────────────────────────────────────────
  const [selectedMinistryId, setSelectedMinistryId] = useState<string | null>(null);
  const [newMinistryName, setNewMinistryName] = useState("");
  const [newMinistryDesc, setNewMinistryDesc] = useState("");
  const [savingMinistry, setSavingMinistry] = useState(false);

  // ── Agreements ─────────────────────────────────────────────────────────────
  type AgreementMeta = { token: string; customer_signed_at: string | null; staff_signed_at: string | null };
  const [agreements, setAgreements] = useState<Record<string, AgreementMeta>>({});
  const [sendingAgreement, setSendingAgreement] = useState<string | null>(null);
  const [countersigning, setCountersigning] = useState<string | null>(null);
  const [countersignName, setCountersignName] = useState("");

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
  // ── Agreement helpers ────────────────────────────────────────────────────────
  const siteUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? "");

  async function sendAgreement(req: Request) {
    setSendingAgreement(req.id);
    try {
      const roomLabel = req.room;
      const dateLabel = new Date(req.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const summary = `${roomLabel} — ${dateLabel}`;
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: req.id, reservation_summary: summary, contact_name: req.name }),
      });
      const data = await res.json();
      if (!res.ok) { alert("Error creating agreement: " + (data.error ?? "Unknown")); return; }
      const { token } = data;
      setAgreements(prev => ({ ...prev, [req.id]: { token, customer_signed_at: null, staff_signed_at: null } }));
      const link = `${siteUrl}/agree/${token}`;
      await navigator.clipboard.writeText(link);
      alert(`Agreement link copied to clipboard:

${link}

Send this to ${req.name} (${req.email}).`);
    } catch { alert("Failed to create agreement — please try again."); }
    finally { setSendingAgreement(null); }
  }

  async function doCountersign(req: Request) {
    const name = countersignName.trim();
    if (!name) return;
    const ag = agreements[req.id];
    if (!ag) return;
    try {
      const res = await fetch("/api/agreements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ag.token, staff_name: name }),
      });
      const data = await res.json();
      if (!res.ok) { alert("Error countersigning: " + (data.error ?? "Unknown")); return; }
      setAgreements(prev => ({ ...prev, [req.id]: { ...ag, staff_signed_at: data.staff_signed_at } }));
      setCountersigning(null);
      setCountersignName("");
      alert("Agreement fully executed! Both parties have signed.");
    } catch { alert("Failed to countersign — please try again."); }
  }

  const confirmedThisMonth = requests.filter(
    (r) => r.status === "Confirmed" && r.date.startsWith("2026-10")
  ).length;
  const revenue = requests
    .filter((r) => r.status === "Confirmed" || r.status === "Deposit Received")
    .reduce((s, r) => s + r.estimate, 0);

  return (
    <div className="min-h-screen bg-ink font-sans">
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
                    : "bg-ink-soft text-slate border-parchment/15 hover:border-parchment/30"
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
              <div className="bg-ink-soft rounded-xl border border-parchment/10 p-10 text-center text-slate text-sm">
                No requests with this status
              </div>
            )}
            {filtered.map((req) => (
              <div
                key={req.id}
                className={`bg-ink-soft rounded-xl border border-parchment/10 p-4 cursor-pointer transition-all hover:shadow-md ${
                  selected?.id === req.id ? "ring-2 ring-[var(--bbc-blue)]" : ""
                }`}
                onClick={() => setSelected(selected?.id === req.id ? null : req)}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-parchment text-sm">{req.name}</p>
                      {req.org && <p className="text-xs text-slate">· {req.org}</p>}
                      {req.flexible && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ Soft block
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate">
                      <span className="font-semibold">{req.event}</span> — {req.room} · {req.date}
                    </p>
                    <p className="text-xs text-slate mt-0.5">{req.id} · Submitted {req.submitted}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-sm text-parchment">${req.estimate.toLocaleString()}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[req.status]}`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {selected?.id === req.id && (
                  <div className="mt-4 pt-4 border-t border-parchment/10 space-y-4">
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
                      <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Pipeline</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {STATUS_ORDER.filter((s) => s !== "Declined").map((s, i) => {
                          const idx = STATUS_ORDER.indexOf(req.status);
                          const sIdx = STATUS_ORDER.indexOf(s);
                          return (
                            <div key={s} className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  req.status === "Declined"
                                    ? "bg-parchment/10 text-slate"
                                    : sIdx < idx
                                    ? "bg-emerald-100 text-emerald-700"
                                    : sIdx === idx
                                    ? "bg-[var(--bbc-navy)] text-white"
                                    : "bg-parchment/10 text-slate"
                                }`}
                              >
                                {s}
                              </span>
                              {i < STATUS_ORDER.length - 2 && (
                                <span className="text-slate/40 text-xs">→</span>
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
                    {req.status === "Confirmed" && (() => {
                      const ag = agreements[req.id];
                      const customerSigned = !!ag?.customer_signed_at;
                      const staffSigned    = !!ag?.staff_signed_at;
                      return (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-semibold text-emerald-600">✓ Confirmed</p>
                          {/* Agreement status */}
                          {!ag && (
                            <button
                              className="btn-outline text-xs"
                              disabled={sendingAgreement === req.id}
                              onClick={(e) => { e.stopPropagation(); sendAgreement(req); }}
                            >
                              {sendingAgreement === req.id ? "Creating…" : "Send Agreement →"}
                            </button>
                          )}
                          {ag && !customerSigned && (
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              ⏳ Agreement sent — awaiting customer signature
                            </p>
                          )}
                          {ag && customerSigned && !staffSigned && (
                            countersigning === req.id ? (
                              <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  className="border border-parchment/20 rounded px-2 py-1 text-xs w-44 bg-ink text-parchment"
                                  placeholder="Your full name"
                                  value={countersignName}
                                  onChange={(e) => setCountersignName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") doCountersign(req); }}
                                  autoFocus
                                />
                                <button className="btn-primary text-xs" onClick={() => doCountersign(req)}>Sign</button>
                                <button className="text-xs text-slate hover:text-parchment" onClick={() => { setCountersigning(null); setCountersignName(""); }}>Cancel</button>
                              </div>
                            ) : (
                              <button
                                className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
                                onClick={(e) => { e.stopPropagation(); setCountersigning(req.id); setCountersignName(""); }}
                              >
                                ✍ Countersign Agreement
                              </button>
                            )
                          )}
                          {ag && customerSigned && staffSigned && (
                            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                              ✓ Agreement fully executed — both parties signed
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    {req.status === "Declined" && (
                      <p className="text-xs text-slate">This request was declined.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          </>)}

          {/* ── Users tab ─────────────────────────────────────────────────── */}
          {tab === "users" && (
            <UsersTab
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              pendingRoles={pendingRoles}
              setPendingRoles={setPendingRoles}
              savingRole={savingRole}
              setSavingRole={setSavingRole}
            />
          )}

          {/* ── Ministries tab ────────────────────────────────────────────── */}
          {tab === "ministries" && (
            <MinistriesTab
              selectedMinistryId={selectedMinistryId}
              setSelectedMinistryId={setSelectedMinistryId}
              newMinistryName={newMinistryName}
              setNewMinistryName={setNewMinistryName}
              newMinistryDesc={newMinistryDesc}
              setNewMinistryDesc={setNewMinistryDesc}
              savingMinistry={savingMinistry}
              setSavingMinistry={setSavingMinistry}
            />
          )}
        </div>

        {/* Right: Calendar sidebar */}
        <div className={`${calOpen ? "block" : "hidden lg:block"}`}>
          <div className="sticky top-24 bg-ink-soft rounded-xl border border-parchment/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest">Combined Calendar</p>
              <p className="text-xs text-slate">Oct – Nov 2026</p>
            </div>
            <p className="text-xs text-slate leading-relaxed">
              Staff view — shows real event names and flex-block flags. Never visible to the public.
            </p>

            <div className="space-y-2">
              {CALENDAR_EVENTS.sort((a, b) => a.date.localeCompare(b.date)).map((ev, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-14">
                    <p className="text-xs font-bold text-parchment">{ev.date.slice(5)}</p>
                    <p className="text-xs text-slate">{ev.room}</p>
                  </div>
                  <div
                    className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium leading-snug border ${
                      ev.kind === "rental"
                        ? "bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--bbc-navy)]"
                        : ev.kind === "flex"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-ink border-parchment/15 text-slate line-through"
                    }`}
                  >
                    {ev.kind === "flex" && <span className="mr-1">⟳</span>}
                    {ev.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-parchment/10 space-y-1.5">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Legend</p>
              <LegendItem color="bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--bbc-navy)]" label="Rental / confirmed event" />
              <LegendItem color="bg-amber-50 border-amber-200 text-amber-800" label="⟳ Standing use · may flex" />
              <LegendItem color="bg-ink border-parchment/15 text-slate" label="Declined" />
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
    <div className="bg-ink-soft rounded-xl border border-parchment/10 p-4">
      <p className="text-xs text-slate font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate font-semibold uppercase tracking-wider">{label}</p>
      <p className="font-medium text-parchment">{value}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded px-2 py-0.5 text-xs border ${color}`}>Sample</span>
      <span className="text-xs text-slate">{label}</span>
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
        <h2 className="text-lg font-bold text-parchment">Blackout Rules</h2>
        <p className="text-sm text-slate mt-1">
          Dates and times blocked on the public reservation form. PCO calendar is unaffected.
        </p>
      </div>

      {/* Current rules */}
      <div className="bg-ink-soft rounded-xl border border-parchment/10 divide-y divide-parchment/5">
        {loading && (
          <p className="px-5 py-4 text-sm text-slate">Loading…</p>
        )}
        {!loading && rules.length === 0 && (
          <p className="px-5 py-4 text-sm text-slate">No blackout rules yet.</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-parchment">{rule.label || ruleDescription(rule)}</p>
              {rule.label && (
                <p className="text-xs text-slate">{ruleDescription(rule)}</p>
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
      <div className="bg-ink-soft rounded-xl border border-parchment/10 p-5 space-y-4">
        <p className="text-sm font-semibold text-parchment">Add a rule</p>

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
                  ? "bg-parchment text-ink border-parchment"
                  : "bg-ink text-slate border-parchment/20 hover:bg-parchment/10"
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
              <label className="block text-xs font-semibold text-slate mb-1">Day of week</label>
              <select
                value={newDow}
                onChange={e => setNewDow(Number(e.target.value))}
                className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
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
              <label className="block text-xs font-semibold text-slate mb-1">Time slot</label>
              <select
                value={newSlot}
                onChange={e => setNewSlot(e.target.value)}
                className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
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
              <label className="block text-xs font-semibold text-slate mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
              />
            </div>
          )}

          {/* Label */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate mb-1">
              Label <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Christmas, Church Night…"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
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

// ─── Mock data for Users and Ministries tabs ───────────────────────────────────
type MockUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "system_admin" | "booking_admin" | "ministry_coordinator" | "member";
  lastActive: string;
  reservationCount: number;
  orphaned?: boolean;
};

type MockMinistry = {
  id: string;
  name: string;
  description: string;
  members: { userId: string; name: string; email: string; isCoordinator: boolean }[];
  reservationCount: number;
};

const MOCK_USERS: MockUser[] = [
  { id: "u1", name: "Josiah King",     email: "jking@brainerdbaptist.org",   role: "owner",               lastActive: "Today",    reservationCount: 12 },
  { id: "u2", name: "Sarah Mitchell",  email: "smitchell@brainerdbaptist.org", role: "system_admin",      lastActive: "Yesterday", reservationCount: 4  },
  { id: "u3", name: "Tom Alvarez",     email: "talvarez@brainerdbaptist.org", role: "booking_admin",       lastActive: "2 days ago", reservationCount: 2 },
  { id: "u4", name: "Rachel Brooks",   email: "rbrooks@example.com",          role: "ministry_coordinator", lastActive: "1 week ago", reservationCount: 7 },
  { id: "u5", name: "Mark Nguyen",     email: "mnguyen@example.com",          role: "member",              lastActive: "3 days ago", reservationCount: 3 },
  { id: "u6", name: "Olivia Carter",   email: "ocarter@example.com",          role: "member",              lastActive: "2 weeks ago", reservationCount: 1 },
  { id: "u7", name: "(Deleted user)",  email: "—",                            role: "member",              lastActive: "—",         reservationCount: 2, orphaned: true },
];

const MOCK_MINISTRIES: MockMinistry[] = [
  {
    id: "m1", name: "Youth Ministry", description: "Student ministry, grades 6–12.",
    reservationCount: 8,
    members: [
      { userId: "u4", name: "Rachel Brooks", email: "rbrooks@example.com", isCoordinator: true },
      { userId: "u5", name: "Mark Nguyen",   email: "mnguyen@example.com", isCoordinator: false },
    ],
  },
  {
    id: "m2", name: "Worship Team", description: "Sunday worship and special events.",
    reservationCount: 5,
    members: [
      { userId: "u6", name: "Olivia Carter", email: "ocarter@example.com", isCoordinator: true },
    ],
  },
  {
    id: "m3", name: "Care & Counseling", description: "Pastoral care programs.",
    reservationCount: 3,
    members: [],
  },
];

const ROLE_LABELS_DISPLAY: Record<MockUser["role"], string> = {
  owner: "Owner",
  system_admin: "System Admin",
  booking_admin: "Booking Admin",
  ministry_coordinator: "Ministry Coordinator",
  member: "Member",
};

const ROLE_BADGE_COLORS: Record<MockUser["role"], string> = {
  owner:                "bg-amber-100 text-amber-800 border-amber-200",
  system_admin:         "bg-purple-100 text-purple-800 border-purple-200",
  booking_admin:        "bg-blue-100 text-blue-800 border-blue-200",
  ministry_coordinator: "bg-emerald-100 text-emerald-700 border-emerald-200",
  member:               "bg-parchment/15 text-slate border-parchment/20",
};

// ─── UsersTab component ────────────────────────────────────────────────────────
function UsersTab({
  userSearch, setUserSearch,
  pendingRoles, setPendingRoles,
  savingRole, setSavingRole,
}: {
  userSearch: string; setUserSearch: (v: string) => void;
  pendingRoles: Record<string, string>; setPendingRoles: (v: Record<string, string>) => void;
  savingRole: string | null; setSavingRole: (v: string | null) => void;
}) {
  const search = userSearch.toLowerCase();
  const filtered = MOCK_USERS.filter(
    u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
  );
  const orphaned = MOCK_USERS.filter(u => u.orphaned);

  async function saveRole(userId: string) {
    if (!pendingRoles[userId]) return;
    setSavingRole(userId);
    // TODO: POST /api/bx/roles { userId, role: pendingRoles[userId] }
    await new Promise(r => setTimeout(r, 600));
    setSavingRole(null);
    setPendingRoles({ ...pendingRoles, [userId]: "" });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-parchment">User Management</h2>
          <p className="text-sm text-slate mt-0.5">Assign roles and manage access for all BX accounts.</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment w-64"
        />
      </div>

      {/* Orphaned reservations alert */}
      {orphaned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">⚠ Orphaned reservations</p>
          <p className="text-xs text-amber-700 mb-3">
            {orphaned.length} reservation{orphaned.length > 1 ? "s" : ""} have no owner because their account was deleted and no co-owner existed.
            Reassign them to a member below.
          </p>
          {orphaned.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-3 bg-white/60 rounded-lg px-4 py-2 mt-2 border border-amber-100">
              <span className="text-sm font-medium text-amber-900">
                {u.reservationCount} orphaned reservation{u.reservationCount > 1 ? "s" : ""}
              </span>
              <button className="btn-outline text-xs border-amber-300 text-amber-800 hover:border-amber-500">
                Reassign →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* User list */}
      <div className="bg-ink-soft rounded-xl border border-parchment/10 divide-y divide-parchment/5">
        {filtered.length === 0 && (
          <p className="px-5 py-5 text-sm text-slate">No users match your search.</p>
        )}
        {filtered.filter(u => !u.orphaned).map(user => {
          const pending = pendingRoles[user.id];
          const isSaving = savingRole === user.id;
          return (
            <div key={user.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              {/* Identity */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-parchment truncate">{user.name}</p>
                <p className="text-xs text-slate truncate">{user.email}</p>
              </div>

              {/* Stats */}
              <div className="text-right hidden sm:block flex-shrink-0">
                <p className="text-xs text-slate">{user.reservationCount} reservations</p>
                <p className="text-xs text-slate/60">Active {user.lastActive}</p>
              </div>

              {/* Current role badge */}
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${ROLE_BADGE_COLORS[user.role]}`}>
                {ROLE_LABELS_DISPLAY[user.role]}
              </span>

              {/* Role reassignment (system_admin+ only in production) */}
              {user.role !== "owner" && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={pending || user.role}
                    onChange={e => setPendingRoles({ ...pendingRoles, [user.id]: e.target.value })}
                    className="border border-parchment/20 rounded-lg px-2 py-1.5 text-xs bg-ink text-parchment"
                  >
                    <option value="booking_admin">Booking Admin</option>
                    <option value="ministry_coordinator">Ministry Coordinator</option>
                    <option value="member">Member</option>
                  </select>
                  {pending && pending !== user.role && (
                    <button
                      onClick={() => saveRole(user.id)}
                      disabled={isSaving}
                      className="btn-primary text-xs disabled:opacity-40"
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate">
        Role changes take effect immediately. The <strong className="text-parchment">Owner</strong> role can only be transferred through account settings.
        System Admins cannot promote to System Admin or Owner.
      </p>
    </div>
  );
}

// ─── MinistriesTab component ───────────────────────────────────────────────────
function MinistriesTab({
  selectedMinistryId, setSelectedMinistryId,
  newMinistryName, setNewMinistryName,
  newMinistryDesc, setNewMinistryDesc,
  savingMinistry, setSavingMinistry,
}: {
  selectedMinistryId: string | null; setSelectedMinistryId: (v: string | null) => void;
  newMinistryName: string; setNewMinistryName: (v: string) => void;
  newMinistryDesc: string; setNewMinistryDesc: (v: string) => void;
  savingMinistry: boolean; setSavingMinistry: (v: boolean) => void;
}) {
  const selected = MOCK_MINISTRIES.find(m => m.id === selectedMinistryId) ?? null;

  async function createMinistry() {
    if (!newMinistryName.trim()) return;
    setSavingMinistry(true);
    // TODO: POST /api/bx/ministries { name, description }
    await new Promise(r => setTimeout(r, 600));
    setNewMinistryName("");
    setNewMinistryDesc("");
    setSavingMinistry(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-parchment">Ministries</h2>
        <p className="text-sm text-slate mt-0.5">
          Group members into ministries. Ministry Coordinators can book on behalf of their group.
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-5">
        {/* Left: ministry list */}
        <div className="space-y-3">
          <div className="bg-ink-soft rounded-xl border border-parchment/10 divide-y divide-parchment/5">
            {MOCK_MINISTRIES.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMinistryId(selectedMinistryId === m.id ? null : m.id)}
                className={`w-full text-left px-4 py-3.5 transition-colors ${
                  selectedMinistryId === m.id ? "bg-parchment/10" : "hover:bg-parchment/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-parchment">{m.name}</p>
                  <span className="text-xs text-slate flex-shrink-0">
                    {m.members.length} member{m.members.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {m.description && (
                  <p className="text-xs text-slate mt-0.5 truncate">{m.description}</p>
                )}
                <p className="text-xs text-slate/60 mt-0.5">{m.reservationCount} reservations</p>
              </button>
            ))}
          </div>

          {/* Create new ministry */}
          <div className="bg-ink-soft rounded-xl border border-parchment/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate uppercase tracking-widest">New Ministry</p>
            <input
              type="text"
              placeholder="Ministry name"
              value={newMinistryName}
              onChange={e => setNewMinistryName(e.target.value)}
              className="w-full border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newMinistryDesc}
              onChange={e => setNewMinistryDesc(e.target.value)}
              className="w-full border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
            />
            <button
              onClick={createMinistry}
              disabled={savingMinistry || !newMinistryName.trim()}
              className="btn-primary text-sm w-full disabled:opacity-40"
            >
              {savingMinistry ? "Creating…" : "Create Ministry"}
            </button>
          </div>
        </div>

        {/* Right: selected ministry detail */}
        {selected ? (
          <div className="bg-ink-soft rounded-xl border border-parchment/10 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-parchment">{selected.name}</h3>
                {selected.description && (
                  <p className="text-sm text-slate mt-0.5">{selected.description}</p>
                )}
              </div>
              <button className="text-xs text-slate hover:text-parchment border border-parchment/20 rounded px-2 py-1">
                Rename
              </button>
            </div>

            {/* Members */}
            <div>
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Members</p>
              {selected.members.length === 0 && (
                <p className="text-sm text-slate">No members yet — add someone below.</p>
              )}
              <div className="space-y-2">
                {selected.members.map(mem => (
                  <div key={mem.userId} className="flex items-center justify-between gap-3 bg-ink rounded-lg px-3 py-2 border border-parchment/10">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-parchment truncate">{mem.name}</p>
                      <p className="text-xs text-slate truncate">{mem.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {mem.isCoordinator ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                          Coordinator
                        </span>
                      ) : (
                        <button className="text-xs text-slate hover:text-emerald-600 border border-parchment/20 rounded px-2 py-0.5">
                          Make coordinator
                        </button>
                      )}
                      <button className="text-xs text-red-500 hover:text-red-700 font-semibold">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add member */}
            <div className="pt-2 border-t border-parchment/10">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Add Member</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  className="flex-1 border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
                />
                <button className="btn-primary text-sm flex-shrink-0">Add</button>
              </div>
              <p className="text-xs text-slate mt-1">User must have a BX account. They&apos;ll be notified by email.</p>
            </div>

            {/* Ministry reservations link */}
            <div className="pt-2 border-t border-parchment/10">
              <p className="text-xs text-slate">
                <span className="font-semibold text-parchment">{selected.reservationCount}</span> reservations under this ministry.{" "}
                <button
                  onClick={() => setSelectedMinistryId(null)}
                  className="text-[var(--bbc-blue)] hover:underline text-xs"
                >
                  View in Requests →
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-ink-soft rounded-xl border border-parchment/10 p-10 flex items-center justify-center text-center">
            <div>
              <p className="text-2xl mb-2">⛪</p>
              <p className="text-sm text-slate">Select a ministry to view and manage its members.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
