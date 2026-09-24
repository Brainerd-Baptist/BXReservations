
"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Signal = "available" | "ask" | "unavailable" | "loading";
type SetupId = "theater" | "banquet" | "classroom" | "reception" | "cocktail" | "boardroom" | "custom" | "";
type TimeBlockId = "full" | "am" | "pm" | "evening" | "custom";
type SpaceMode = "single" | "main-plus" | "multiple";

const SETUP_STYLES: { id: SetupId; label: string; desc: string }[] = [
  { id: "theater",   label: "Theater",   desc: "Rows of chairs facing a stage or screen" },
  { id: "banquet",   label: "Banquet",   desc: "Round tables for seated meals" },
  { id: "classroom", label: "Classroom", desc: "Tables in rows, chairs behind each" },
  { id: "reception", label: "Reception", desc: "Mixed seating + open floor for mingling" },
  { id: "cocktail",  label: "Cocktail",  desc: "High-top tables, mostly standing" },
  { id: "boardroom", label: "Boardroom", desc: "Single conference table" },
  { id: "custom",    label: "Custom",    desc: "Describe your own setup" },
];

const TIME_BLOCKS: { id: TimeBlockId; label: string; sub: string }[] = [
  { id: "full",    label: "Full Day",   sub: "8 am – 10 pm" },
  { id: "am",      label: "Morning",    sub: "8 am – 12 pm" },
  { id: "pm",      label: "Afternoon",  sub: "1 pm – 5 pm" },
  { id: "evening", label: "Evening",    sub: "5 pm – 10 pm" },
  { id: "custom",  label: "Custom",     sub: "Set your hours" },
];

interface RoomSelection {
  roomId: string;
  setup: SetupId;
  customSetup: string;
  requested: boolean;
  role: "main" | "extra";
}

interface DayConfig {
  date: string;
  included: boolean;
  headcount: number;
  timeBlock: TimeBlockId;
  customStart: string;
  customEnd: string;
  rooms: RoomSelection[];
  availability: Record<string, Signal>;
  availabilityFetched: boolean;
}

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  org: string;
  eventName: string;
  isNonProfit: boolean;
}

// ─── Room catalogue ───────────────────────────────────────────────────────────

// Capacities and pricing from official BX Room Rental Information sheet (Rev. 6/24).
// baseNP = non-profit 4-hr rate; basePro = profit/standard 4-hr rate.
// capacityTheater / capacityBanquet = official room seating capacity by style.
const ROOMS = [
  {
    id: "crossing",
    name: "The Crossing",
    description: "Main event space with mezzanine and stage. Galas, conferences, large gatherings.",
    capacityTheater: 400,
    capacityBanquet: 300,
    capacity: 400,
    baseNP: 600,
    basePro: 800,
    image: "/images/rooms/crossing-11.jpg",
    setups: ["theater", "banquet", "reception", "cocktail", "custom"],
  },
  {
    id: "loft",
    name: "The Loft",
    description: "Intimate upstairs space. Great for meetings, small workshops, and rehearsals.",
    capacityTheater: 100,
    capacityBanquet: 80,
    capacity: 100,
    baseNP: 275,
    basePro: 475,
    image: null,
    setups: ["theater", "classroom", "reception", "boardroom", "custom"],
  },
  {
    id: "crossview",
    name: "CrossView",
    description: "Bright open space — excellent for workshops, classes, and community events.",
    capacityTheater: 50,
    capacityBanquet: 40,
    capacity: 50,
    baseNP: 200,
    basePro: 250,
    image: null,
    setups: ["theater", "classroom", "banquet", "reception", "custom"],
  },
  {
    id: "crosspointe-a",
    name: "CrossPointe A",
    description: "Flexible breakout room — can open into B and C for a combined space.",
    capacityTheater: 40,
    capacityBanquet: 30,
    capacity: 40,
    baseNP: 150,
    basePro: 200,
    image: null,
    setups: ["classroom", "boardroom", "theater", "custom"],
  },
  {
    id: "crosspointe-b",
    name: "CrossPointe B",
    description: "Flexible breakout room — can open into A and C for a combined space.",
    capacityTheater: 40,
    capacityBanquet: 30,
    capacity: 40,
    baseNP: 150,
    basePro: 200,
    image: null,
    setups: ["classroom", "boardroom", "theater", "custom"],
  },
  {
    id: "crosspointe-c",
    name: "CrossPointe C",
    description: "Flexible breakout room — can open into A and B for a combined space.",
    capacityTheater: 40,
    capacityBanquet: 30,
    capacity: 40,
    baseNP: 150,
    basePro: 200,
    image: null,
    setups: ["classroom", "boardroom", "theater", "custom"],
  },
  {
    id: "crosstiescafe",
    name: "CrossTies Café",
    description: "Café-style space, perfect for casual meet-ups and coffee conversations.",
    capacityTheater: 60,
    capacityBanquet: 50,
    capacity: 60,
    baseNP: 175,
    basePro: 225,
    image: null,
    setups: ["reception", "cocktail", "custom"],
  },
  {
    id: "crosstiesA",
    name: "CrossTies A",
    description: "Casual lower-level gathering space.",
    capacityTheater: 20,
    capacityBanquet: 10,
    capacity: 20,
    baseNP: 125,
    basePro: 150,
    image: null,
    setups: ["classroom", "reception", "custom"],
  },
  {
    id: "crosstiesB",
    name: "CrossTies B",
    description: "Casual lower-level gathering space.",
    capacityTheater: 20,
    capacityBanquet: 10,
    capacity: 20,
    baseNP: 125,
    basePro: 150,
    image: null,
    setups: ["classroom", "reception", "custom"],
  },
  {
    id: "crosstiesC",
    name: "CrossTies C",
    description: "Casual lower-level gathering space.",
    capacityTheater: 20,
    capacityBanquet: 10,
    capacity: 20,
    baseNP: 125,
    basePro: 150,
    image: null,
    setups: ["classroom", "reception", "custom"],
  },
] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────

function datesBetween(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  const cur = new Date(start + "T12:00:00");
  const last = new Date(end + "T12:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function fmtShortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function dayEstimate(day: DayConfig, isNP: boolean): number {
  return day.rooms
    .filter(r => !r.requested)
    .reduce((sum, r) => {
      const room = ROOMS.find(ro => ro.id === r.roomId);
      return sum + (room ? (isNP ? room.baseNP : room.basePro) : 0);
    }, 0);
}

function totalEstimate(days: DayConfig[], isNP: boolean): number {
  return days.filter(d => d.included).reduce((sum, d) => sum + dayEstimate(d, isNP), 0);
}

/** Returns a recommendation tag (label + color) based on headcount vs. room capacity. */
function getRoomTag(headcount: number, capacityTheater: number, capacityBanquet: number): {
  label: string; color: string;
} | null {
  if (headcount <= 0) return null;
  const ratio = headcount / capacityTheater;
  if (headcount > capacityTheater) {
    // Exceeds theater — always warn
    return { label: "Too small", color: "text-red-500 bg-red-50 border-red-200" };
  }
  if (ratio >= 0.6 && ratio <= 1.0) {
    return { label: "Best fit", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  }
  if (ratio >= 0.25 && ratio < 0.6) {
    return { label: "Good fit", color: "text-[#00abc9] bg-[#f0fafc] border-[#b3e8f0]" };
  }
  // ratio < 0.25 — much bigger than needed
  if (capacityBanquet > 0 && headcount <= capacityBanquet) {
    return { label: "Oversized", color: "text-gray-400 bg-gray-50 border-gray-200" };
  }
  return { label: "Oversized", color: "text-gray-400 bg-gray-50 border-gray-200" };
}

function signalBadge(sig: Signal) {
  switch (sig) {
    case "available":   return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Available</span>;
    case "ask":         return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Ask Us</span>;
    case "unavailable": return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Unavailable</span>;
    default:            return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 animate-pulse">Checking…</span>;
  }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["About You", "Build Your Event", "Review & Request"] as const;

function StepBar({ step }: { step: number }) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                i < step  ? "bg-[#00abc9] border-[#00abc9] text-white" :
                i === step ? "bg-white border-[#00abc9] text-[#00abc9]" :
                             "bg-white border-gray-200 text-gray-400"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap font-medium ${i === step ? "text-[#00205B]" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${i < step ? "bg-[#00abc9]" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 0: Contact ──────────────────────────────────────────────────────────

function ContactStep({
  contact, onChange, spaceMode, onSpaceMode, onNext, isSignedIn,
}: {
  contact: ContactInfo;
  onChange: (f: Partial<ContactInfo>) => void;
  spaceMode: SpaceMode;
  onSpaceMode: (m: SpaceMode) => void;
  onNext: () => void;
  isSignedIn: boolean;
}) {
  const valid = contact.name && contact.email && contact.phone && contact.org && contact.eventName;

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
      <h2 className="text-2xl font-bold text-[#00205B] mb-1">Let's get started</h2>
      <p className="text-gray-500 mb-4">Tell us a bit about you and your event.</p>

      {/* Returning-user nudge — only shown when signed out */}
      {!isSignedIn && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-gray-500">Already have an account?</p>
          <a
            href="/login?next=/reserve"
            className="text-sm font-semibold text-[#00abc9] hover:text-[#009ab7] transition-colors"
          >
            Sign in to pre-fill →
          </a>
        </div>
      )}

      <div className="space-y-4">
        <Field label="Your name" required>
          <input type="text" value={contact.name} onChange={e => onChange({ name: e.target.value })}
            placeholder="Jane Smith" autoComplete="name" className={input} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" required>
            <input type="email" value={contact.email} onChange={e => onChange({ email: e.target.value })}
              placeholder="jane@example.com" autoComplete="email" className={input} />
          </Field>
          <Field label="Phone" required>
            <input type="tel" value={contact.phone}
              onChange={e => {
                // Allow digits, spaces, dashes, parens, plus
                const v = e.target.value.replace(/[^\d\s\-().+]/g, "");
                onChange({ phone: v });
              }}
              placeholder="(555) 000-0000" autoComplete="tel"
              pattern="[\d\s\-().+]{7,}" minLength={7}
              className={input} />
          </Field>
        </div>
        <Field label="Organization / Church" required>
          <input type="text" value={contact.org} onChange={e => onChange({ org: e.target.value })}
            placeholder="First Baptist Church of Example" autoComplete="organization" className={input} />
        </Field>
        <Field label="Event name" required>
          <input type="text" value={contact.eventName} onChange={e => onChange({ eventName: e.target.value })}
            placeholder="Annual Gala, Youth Conference, Wedding…" className={input} />
        </Field>

        {/* Space mode selector */}
        <div className="pt-2">
          <p className="text-sm font-medium text-gray-700 mb-2">How many spaces do you need? <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-1 gap-2">
            {([
              { mode: "single"    as SpaceMode, label: "One room",           desc: "A single space for your entire event" },
              { mode: "main-plus" as SpaceMode, label: "Main room + extras", desc: "A primary space plus breakout or support rooms" },
              { mode: "multiple"  as SpaceMode, label: "Multiple spaces",    desc: "Several independent rooms with no primary" },
            ]).map(opt => (
              <button key={opt.mode} type="button"
                onClick={() => onSpaceMode(opt.mode)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  spaceMode === opt.mode
                    ? "border-[#00abc9] bg-[#f0fafc]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${spaceMode === opt.mode ? "text-[#00205B]" : "text-gray-700"}`}>{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </div>
                {spaceMode === opt.mode && <span className="text-[#00abc9] font-bold text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onChange({ isNonProfit: !contact.isNonProfit })}
            className={`w-10 h-6 rounded-full relative transition-colors ${contact.isNonProfit ? "bg-[#00abc9]" : "bg-gray-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${contact.isNonProfit ? "translate-x-4" : ""}`} />
          </button>
          <span className="text-sm text-gray-700">We are a non-profit organization</span>
        </div>
        {contact.isNonProfit && (
          <p className="text-xs text-[#00abc9] -mt-2 pl-14">Non-profit rates will be applied to your estimate.</p>
        )}
      </div>

      </div>{/* end white card */}

      <div className="mt-6 flex justify-end">
        <button onClick={onNext} disabled={!valid}
          className="px-8 py-3 rounded-xl bg-[#00abc9] text-white font-semibold text-sm disabled:opacity-40 hover:bg-[#0099b5] transition-colors">
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 1: Day builder ──────────────────────────────────────────────────────

function BuilderStep({
  days, setDays, startDate, setStartDate, endDate, setEndDate,
  defaultHeadcount, setDefaultHeadcount, spaceMode, breakoutGroupSize, setBreakoutGroupSize,
  isNP, onBack, onNext,
}: {
  days: DayConfig[];
  setDays: React.Dispatch<React.SetStateAction<DayConfig[]>>;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string;   setEndDate:   (v: string) => void;
  defaultHeadcount: number; setDefaultHeadcount: (v: number) => void;
  spaceMode: SpaceMode;
  breakoutGroupSize: number; setBreakoutGroupSize: (v: number) => void;
  isNP: boolean;
  onBack: () => void; onNext: () => void;
}) {
  // Fetch availability whenever included days change
  const fetchAvailability = useCallback(async (day: DayConfig) => {
    if (day.availabilityFetched) return;
    const roomIds = ROOMS.map(r => r.id).join(",");
    try {
      const res = await fetch(`/api/availability?date=${day.date}&rooms=${roomIds}`);
      const data: Record<string, Signal> = await res.json();
      setDays(prev => prev.map(d =>
        d.date === day.date ? { ...d, availability: data, availabilityFetched: true } : d
      ));
    } catch {
      // silently degrade
    }
  }, [setDays]);

  useEffect(() => {
    days.filter(d => d.included && !d.availabilityFetched).forEach(fetchAvailability);
  }, [days, fetchAvailability]);

  // Update days when date range changes
  useEffect(() => {
    const dates = datesBetween(startDate, endDate);
    if (!dates.length) { setDays([]); return; }
    setDays(prev => {
      const byDate = Object.fromEntries(prev.map(d => [d.date, d]));
      return dates.map(date => byDate[date] ?? {
        date, included: true,
        headcount: defaultHeadcount,
        timeBlock: "full" as TimeBlockId,
        customStart: "08:00", customEnd: "22:00",
        rooms: [],
        availability: Object.fromEntries(ROOMS.map(r => [r.id, "loading" as Signal])),
        availabilityFetched: false,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  function updateDay(date: string, patch: Partial<DayConfig>) {
    setDays(prev => prev.map(d => d.date === date ? { ...d, ...patch } : d));
  }

  function toggleRoom(day: DayConfig, roomId: string, role: "main" | "extra" = "extra") {
    const existing = day.rooms.find(r => r.roomId === roomId);
    const sig = day.availability[roomId] ?? "loading";
    if (existing) {
      updateDay(day.date, { rooms: day.rooms.filter(r => r.roomId !== roomId) });
    } else {
      updateDay(day.date, {
        rooms: [...day.rooms, {
          roomId, setup: "" as SetupId, customSetup: "",
          requested: sig === "unavailable",
          role,
        }],
      });
    }
  }

  function updateRoomSelection(day: DayConfig, roomId: string, patch: Partial<RoomSelection>) {
    updateDay(day.date, {
      rooms: day.rooms.map(r => r.roomId === roomId ? { ...r, ...patch } : r),
    });
  }

  function copyToNext(dayIdx: number) {
    if (dayIdx >= days.length - 1) return;
    const src = days[dayIdx];
    setDays(prev => prev.map((d, i) => i === dayIdx + 1 ? {
      ...d,
      headcount: src.headcount,
      timeBlock: src.timeBlock,
      customStart: src.customStart,
      customEnd: src.customEnd,
      rooms: src.rooms.map(r => ({ ...r })),
    } : d));
  }

  function applyToAll(dayIdx: number) {
    const src = days[dayIdx];
    setDays(prev => prev.map((d, i) => i === dayIdx ? d : {
      ...d,
      headcount: src.headcount,
      timeBlock: src.timeBlock,
      customStart: src.customStart,
      customEnd: src.customEnd,
      rooms: src.rooms.map(r => ({ ...r })),
    }));
  }

  const activeDays = days.filter(d => d.included);
  const canContinue = activeDays.length > 0 && activeDays.some(d => d.rooms.length > 0);
  const total = totalEstimate(days, isNP);

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-[#00205B] mb-1">Build your event</h2>
      <p className="text-gray-500 mb-6">Set your dates, configure each day, and choose your spaces.</p>

      {/* Date range + default headcount */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 sm:gap-4">
          <Field label="Start date" required>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className={input} />
          </Field>
          <Field label="End date" required>
            <input type="date" value={endDate} min={startDate}
              onChange={e => setEndDate(e.target.value)} className={input} />
          </Field>
        </div>
        <Field label={`Default headcount (applies to all days unless overridden)`}>
          <input type="number" min={1} value={defaultHeadcount}
            onChange={e => {
              const n = parseInt(e.target.value) || 1;
              setDefaultHeadcount(n);
              setDays(prev => prev.map(d => ({ ...d, headcount: n })));
            }}
            className={`${input} w-32`} />
        </Field>
      </div>

      {/* Day cards */}
      {days.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium">Pick your dates above to start building.</p>
        </div>
      )}

      <div className="space-y-4">
        {days.map((day, idx) => (
          <div key={day.date} data-day-idx={idx}>
            <DayCard
              day={day}
              dayIdx={idx}
              total={days.length}
              isNP={isNP}
              spaceMode={spaceMode}
              breakoutGroupSize={breakoutGroupSize}
              onBreakoutGroupSize={setBreakoutGroupSize}
              onToggleInclude={() => updateDay(day.date, { included: !day.included })}
              onHeadcount={n => updateDay(day.date, { headcount: n })}
              onTimeBlock={tb => updateDay(day.date, { timeBlock: tb })}
              onCustomTime={(s, e2) => updateDay(day.date, { customStart: s, customEnd: e2 })}
              onToggleRoom={(roomId, role) => toggleRoom(day, roomId, role)}
              onUpdateRoom={(roomId, patch) => updateRoomSelection(day, roomId, patch)}
              onCopyToNext={() => {
                copyToNext(idx);
                setTimeout(() => {
                  const next = document.querySelector(`[data-day-idx="${idx + 1}"]`);
                  if (next) next.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
              onApplyToAll={() => applyToAll(idx)}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      {total > 0 && (
        <div className="mt-6 bg-[#00205B] text-white rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-200 uppercase tracking-wide">Estimated total</p>
            <p className="text-2xl font-bold">${total.toLocaleString()}</p>
            <p className="text-xs text-blue-200 mt-0.5">
              {isNP ? "Non-profit" : "Standard"} rates · Final pricing confirmed by our team
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-200">{activeDays.length} day{activeDays.length !== 1 ? "s" : ""}</p>
            <p className="text-sm text-blue-200">
              {activeDays.reduce((sum, d) => sum + d.rooms.filter(r => !r.requested).length, 0)} room selections
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-6 py-3 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-100 transition-colors">
          ← Back
        </button>
        <button onClick={onNext} disabled={!canContinue}
          className="px-8 py-3 rounded-xl bg-[#00abc9] text-white font-semibold text-sm disabled:opacity-40 hover:bg-[#0099b5] transition-colors">
          Review & Request →
        </button>
      </div>
    </div>
  );
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  day, dayIdx, total, isNP, spaceMode, breakoutGroupSize, onBreakoutGroupSize,
  onToggleInclude, onHeadcount, onTimeBlock, onCustomTime,
  onToggleRoom, onUpdateRoom, onCopyToNext, onApplyToAll,
}: {
  day: DayConfig; dayIdx: number; total: number; isNP: boolean;
  spaceMode: SpaceMode;
  breakoutGroupSize: number;
  onBreakoutGroupSize: (n: number) => void;
  onToggleInclude: () => void;
  onHeadcount: (n: number) => void;
  onTimeBlock: (tb: TimeBlockId) => void;
  onCustomTime: (start: string, end: string) => void;
  onToggleRoom: (roomId: string, role: "main" | "extra") => void;
  onUpdateRoom: (roomId: string, patch: Partial<RoomSelection>) => void;
  onCopyToNext: () => void;
  onApplyToAll: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const est = dayEstimate(day, isNP);

  return (
    <div className={`rounded-2xl border transition-all ${day.included ? "border-gray-200 bg-white shadow-sm" : "border-dashed border-gray-200 bg-gray-50 opacity-60"}`}>
      {/* Day header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggleInclude(); }}
          title={day.included ? "Remove this day" : "Include this day"}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            day.included ? "bg-[#00abc9] border-[#00abc9] text-white" : "border-gray-300 bg-white"
          }`}
        >
          {day.included && <span className="text-xs font-bold">✓</span>}
        </button>
        <div className="flex-1">
          <p className="font-semibold text-[#00205B]">{fmtDate(day.date)}</p>
          {day.included && (
            <p className="text-xs text-gray-400 mt-0.5">
              {day.rooms.filter(r => !r.requested).length > 0
                ? `${day.rooms.filter(r => !r.requested).length} room${day.rooms.filter(r => !r.requested).length !== 1 ? "s" : ""} selected${est ? ` · est. $${est.toLocaleString()}` : ""}`
                : "No rooms selected yet"}
              {day.rooms.some(r => r.requested) ? ` · ${day.rooms.filter(r => r.requested).length} requested` : ""}
            </p>
          )}
        </div>
        {day.included && (
          <div className="flex items-center gap-2 mr-2" onClick={e => e.stopPropagation()}>
            {dayIdx < total - 1 && (
              <button onClick={onCopyToNext}
                className="text-xs px-2.5 py-1 rounded-lg bg-[#f0fafc] border border-[#00abc9]/30 text-[#00abc9] hover:bg-[#00abc9] hover:text-white font-medium whitespace-nowrap transition-colors active:scale-95">
                Copy to next ↓
              </button>
            )}
            {total > 1 && (
              <button onClick={onApplyToAll}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium whitespace-nowrap">
                Apply to all
              </button>
            )}
          </div>
        )}
        <span className="text-gray-300 text-sm">{expanded && day.included ? "▲" : "▼"}</span>
      </div>

      {/* Day body */}
      {expanded && day.included && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5">
          {/* Headcount + time block */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Headcount</label>
              <div className="flex items-center gap-2">
                <button onClick={() => onHeadcount(Math.max(1, day.headcount - 10))}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold">−</button>
                <input type="number" min={1} value={day.headcount}
                  onChange={e => onHeadcount(parseInt(e.target.value) || 1)}
                  className="w-16 text-center border border-gray-200 rounded-lg py-1 text-sm" />
                <button onClick={() => onHeadcount(day.headcount + 10)}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold">+</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Time block</label>
              <div className="flex gap-1 flex-wrap">
                {TIME_BLOCKS.map(tb => (
                  <button key={tb.id} onClick={() => onTimeBlock(tb.id)}
                    title={tb.sub}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      day.timeBlock === tb.id
                        ? "bg-[#00abc9] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {tb.label}
                  </button>
                ))}
              </div>
            </div>
            {day.timeBlock === "custom" && (
              <div className="flex items-center gap-2">
                <input type="time" value={day.customStart}
                  onChange={e => onCustomTime(e.target.value, day.customEnd)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
                <span className="text-gray-400 text-sm">to</span>
                <input type="time" value={day.customEnd}
                  onChange={e => onCustomTime(day.customStart, e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
              </div>
            )}
          </div>

          {/* Room grid — space-mode-aware */}
          <div className="space-y-5">
            {spaceMode === "main-plus" && (
              <div className="bg-[#f0fafc] border border-[#b3e8f0] rounded-xl p-3">
                <p className="text-xs font-semibold text-[#00205B] uppercase tracking-wide mb-2">Breakout calculator</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">People per breakout group</label>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => onBreakoutGroupSize(Math.max(5, breakoutGroupSize - 5))}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 flex items-center justify-center">−</button>
                      <span className="text-base font-semibold text-[#00205B] w-8 text-center">{breakoutGroupSize}</span>
                      <button type="button"
                        onClick={() => onBreakoutGroupSize(Math.min(200, breakoutGroupSize + 5))}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 flex items-center justify-center">+</button>
                    </div>
                  </div>
                  {day.headcount > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Rooms needed</p>
                      <p className="text-2xl font-bold text-[#00205B]">{Math.ceil(day.headcount / breakoutGroupSize)}</p>
                      <p className="text-[10px] text-gray-400">{day.headcount} people ÷ {breakoutGroupSize}/group</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main / single space picker */}
            {(spaceMode === "single" || spaceMode === "main-plus") && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
                  {spaceMode === "main-plus" ? "🏛️ Main Space" : "Select your space"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROOMS.map(room => {
                    const sig = day.availability[room.id] ?? "loading";
                    const sel = day.rooms.find(r => r.roomId === room.id);
                    const isSelected = !!sel && sel.role === "main";
                    const isUnavailable = sig === "unavailable";
                    const mainPicked = day.rooms.find(r => r.role === "main");
                    const isDisabled = spaceMode === "single" && !!mainPicked && mainPicked.roomId !== room.id;
                    const tag = getRoomTag(day.headcount, room.capacityTheater, room.capacityBanquet);
                    return (
                      <div key={room.id}
                        className={`rounded-xl border-2 transition-all overflow-hidden ${
                          isDisabled ? "opacity-40 pointer-events-none" :
                          isSelected
                            ? isUnavailable && sel?.requested ? "border-amber-400 bg-amber-50" : "border-[#00abc9] bg-[#f0fafc]"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}>
                        {room.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={room.image} alt={room.name}
                            className={`w-full h-24 object-cover ${isUnavailable && !isSelected ? "opacity-40" : ""}`} />
                        )}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <p className={`font-semibold text-sm ${isUnavailable && !isSelected ? "text-gray-400" : "text-[#00205B]"}`}>{room.name}</p>
                              <p className="text-xs text-gray-400">Theater {room.capacityTheater} · Banquet {room.capacityBanquet}</p>
                              {tag && <span className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-tight ${tag.color}`}>{tag.label}</span>}
                            </div>
                            {signalBadge(sig)}
                          </div>
                          <p className={`text-xs mb-3 leading-relaxed ${isUnavailable && !isSelected ? "text-gray-300" : "text-gray-500"}`}>{room.description}</p>
                          <p className={`text-xs font-medium mb-3 ${isUnavailable && !isSelected ? "text-gray-300" : "text-gray-400"}`}>From ${(isNP ? room.baseNP : room.basePro).toLocaleString()} / 4 hrs</p>
                          {!isUnavailable ? (
                            <button onClick={() => onToggleRoom(room.id, "main")}
                              className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${isSelected ? "bg-[#00abc9] text-white hover:bg-[#0099b5]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                              {isSelected ? "✓ Selected — click to remove" : spaceMode === "main-plus" ? "Select as main space" : "Select this space"}
                            </button>
                          ) : (
                            <button onClick={() => onToggleRoom(room.id, "main")}
                              className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${isSelected && sel?.requested ? "bg-amber-400 text-white hover:bg-amber-500" : "bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700"}`}>
                              {isSelected && sel?.requested ? "✓ Added to request — click to remove" : "Request anyway"}
                            </button>
                          )}
                          {isSelected && !sel?.requested && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">Setup style</p>
                              <div className="flex flex-wrap gap-1">
                                {(room.setups as readonly string[]).map(sid => {
                                  const s = SETUP_STYLES.find(x => x.id === sid);
                                  if (!s) return null;
                                  return (
                                    <button key={sid} onClick={() => onUpdateRoom(room.id, { setup: sid as SetupId })} title={s.desc}
                                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${sel?.setup === sid ? "bg-[#00205B] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                      {s.label}
                                    </button>
                                  );
                                })}
                              </div>
                              {sel?.setup === "custom" && (
                                <input type="text" placeholder="Describe your setup…" value={sel.customSetup}
                                  onChange={e => onUpdateRoom(room.id, { customSetup: e.target.value })}
                                  className={`${input} mt-2 text-xs`} />
                              )}
                            </div>
                          )}
                          {isSelected && sel?.requested && (
                            <p className="mt-2 text-xs text-amber-600 italic">This space may be in conflict. We will review and follow up with you.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extra / additional spaces (main-plus and multiple modes) */}
            {(spaceMode === "main-plus" || spaceMode === "multiple") && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
                  {spaceMode === "main-plus" ? "➕ Additional Spaces" : "Select spaces for this day"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROOMS.map(room => {
                    const sig = day.availability[room.id] ?? "loading";
                    const sel = day.rooms.find(r => r.roomId === room.id);
                    if (spaceMode === "main-plus" && sel?.role === "main") return null;
                    const isSelected = !!sel && sel.role === "extra";
                    const isUnavailable = sig === "unavailable";
                    const effectiveHC = spaceMode === "main-plus" ? breakoutGroupSize : day.headcount;
                    const tag = getRoomTag(effectiveHC, room.capacityTheater, room.capacityBanquet);
                    return (
                      <div key={room.id}
                        className={`rounded-xl border-2 transition-all overflow-hidden ${
                          isSelected
                            ? isUnavailable && sel?.requested ? "border-amber-400 bg-amber-50" : "border-[#00abc9] bg-[#f0fafc]"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}>
                        {room.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={room.image} alt={room.name}
                            className={`w-full h-24 object-cover ${isUnavailable && !isSelected ? "opacity-40" : ""}`} />
                        )}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <p className={`font-semibold text-sm ${isUnavailable && !isSelected ? "text-gray-400" : "text-[#00205B]"}`}>{room.name}</p>
                              <p className="text-xs text-gray-400">Theater {room.capacityTheater} · Banquet {room.capacityBanquet}</p>
                              {tag && <span className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-tight ${tag.color}`}>{tag.label}</span>}
                            </div>
                            {signalBadge(sig)}
                          </div>
                          <p className={`text-xs mb-3 leading-relaxed ${isUnavailable && !isSelected ? "text-gray-300" : "text-gray-500"}`}>{room.description}</p>
                          <p className={`text-xs font-medium mb-3 ${isUnavailable && !isSelected ? "text-gray-300" : "text-gray-400"}`}>From ${(isNP ? room.baseNP : room.basePro).toLocaleString()} / 4 hrs</p>
                          {!isUnavailable ? (
                            <button onClick={() => onToggleRoom(room.id, "extra")}
                              className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${isSelected ? "bg-[#00abc9] text-white hover:bg-[#0099b5]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                              {isSelected ? "✓ Added — click to remove" : "Add this space"}
                            </button>
                          ) : (
                            <button onClick={() => onToggleRoom(room.id, "extra")}
                              className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${isSelected && sel?.requested ? "bg-amber-400 text-white hover:bg-amber-500" : "bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700"}`}>
                              {isSelected && sel?.requested ? "✓ Added to request — click to remove" : "Request anyway"}
                            </button>
                          )}
                          {isSelected && !sel?.requested && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">Setup style</p>
                              <div className="flex flex-wrap gap-1">
                                {(room.setups as readonly string[]).map(sid => {
                                  const s = SETUP_STYLES.find(x => x.id === sid);
                                  if (!s) return null;
                                  return (
                                    <button key={sid} onClick={() => onUpdateRoom(room.id, { setup: sid as SetupId })} title={s.desc}
                                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${sel?.setup === sid ? "bg-[#00205B] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                      {s.label}
                                    </button>
                                  );
                                })}
                              </div>
                              {sel?.setup === "custom" && (
                                <input type="text" placeholder="Describe your setup…" value={sel.customSetup}
                                  onChange={e => onUpdateRoom(room.id, { customSetup: e.target.value })}
                                  className={`${input} mt-2 text-xs`} />
                              )}
                            </div>
                          )}
                          {isSelected && sel?.requested && (
                            <p className="mt-2 text-xs text-amber-600 italic">This space may be in conflict. We will review and follow up with you.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Review ───────────────────────────────────────────────────────────

function ReviewStep({
  contact, days, isNP, notes, setNotes, onBack, onSubmit, submitted, bookingNumber,
}: {
  contact: ContactInfo;
  days: DayConfig[];
  isNP: boolean;
  notes: string; setNotes: (v: string) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  submitted: boolean;
  bookingNumber: string;
}) {
  const activeDays = days.filter(d => d.included);
  const total = totalEstimate(days, isNP);

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[#00205B] mb-2">Request received!</h2>
        <p className="text-gray-500 mb-4">
          Thank you, {contact.name.split(" ")[0]}. Our team will review your request for <strong>{contact.eventName}</strong> and follow up within 1–2 business days.
        </p>
        {bookingNumber && (
          <div className="inline-block bg-[#f0fafc] border border-[#00abc9]/30 rounded-2xl px-6 py-4 mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Your booking reference</p>
            <p className="text-2xl font-bold text-[#00205B] tracking-widest font-mono">{bookingNumber}</p>
            <p className="text-xs text-gray-400 mt-1">Save this number — you&apos;ll need it to upload your liability insurance.</p>
          </div>
        )}
        <p className="text-sm text-gray-400">A confirmation has been sent to {contact.email}.</p>

        {/* ── Sign-in nudge ─────────────────────────────────── */}
        <div className="mt-6 p-4 bg-white border border-[#00abc9]/30 rounded-2xl text-left flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#f0fafc] flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[#00abc9]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#00205B] mb-0.5">Save this to your account</p>
            <p className="text-sm text-gray-500 mb-3">
              Create a free account to track your booking status, upload your insurance, and see updates — no need to dig through email.
            </p>
            <a
              href="/login?next=/account"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#00205B] hover:bg-[#001a4d] px-4 py-2 rounded-xl transition-colors"
            >
              Sign in or create account
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
          <p className="text-sm font-semibold text-amber-800 mb-1">Next step: Upload your liability insurance</p>
          <p className="text-sm text-amber-700">To complete your booking, upload a Certificate of Insurance (COI) showing Brainerd Baptist Church as an Additional Insured. We&apos;ll send you a link via email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-[#00205B] mb-1">Review your request</h2>
      <p className="text-gray-500 mb-6">Everything look right? Add any notes, then send your request.</p>

      {/* Contact summary */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About you</p>
        <p className="font-semibold text-[#00205B]">{contact.name} · {contact.org}</p>
        <p className="text-sm text-gray-500">{contact.email} · {contact.phone}</p>
        {isNP && <p className="text-xs text-[#00abc9] mt-1">Non-profit rates applied</p>}
      </div>

      {/* Event summary */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Event</p>
        <p className="font-semibold text-[#00205B] text-lg">{contact.eventName}</p>
        <p className="text-sm text-gray-500">
          {activeDays.length === 1
            ? fmtDate(activeDays[0].date)
            : `${fmtShortDate(activeDays[0].date)} – ${fmtShortDate(activeDays[activeDays.length - 1].date)}`}
          {" · "}{activeDays.length} day{activeDays.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Days breakdown */}
      <div className="space-y-3 mb-4">
        {activeDays.map(day => {
          const tb = TIME_BLOCKS.find(t => t.id === day.timeBlock);
          const confirmed = day.rooms.filter(r => !r.requested);
          const requested = day.rooms.filter(r => r.requested);
          return (
            <div key={day.date} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-[#00205B] text-sm">{fmtDate(day.date)}</p>
                <span className="text-xs text-gray-400">{tb?.label} · {day.headcount} people</span>
              </div>
              {confirmed.length > 0 && (
                <div className="space-y-1 mb-2">
                  {confirmed.map(r => {
                    const room = ROOMS.find(ro => ro.id === r.roomId);
                    const setup = SETUP_STYLES.find(s => s.id === r.setup);
                    return (
                      <div key={r.roomId} className="flex items-center gap-2 text-sm">
                        <span className="text-[#00abc9]">✓</span>
                        <span className="text-gray-700">{room?.name}</span>
                        {setup && <span className="text-xs text-gray-400">— {setup.label}</span>}
                        {r.setup === "custom" && r.customSetup && (
                          <span className="text-xs text-gray-400 italic">— {r.customSetup}</span>
                        )}
                        <span className="ml-auto text-xs font-medium text-gray-500">
                          ${(isNP ? room?.baseNP : room?.basePro)?.toLocaleString() ?? "—"} / 4 hrs
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {requested.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-amber-100">
                  {requested.map(r => {
                    const room = ROOMS.find(ro => ro.id === r.roomId);
                    return (
                      <div key={r.roomId} className="flex items-center gap-2 text-sm text-amber-600">
                        <span>⚠</span>
                        <span>{room?.name}</span>
                        <span className="text-xs ml-1">(conflict — requesting review)</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Estimate */}
      {total > 0 && (
        <div className="bg-[#00205B] text-white rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-200 uppercase tracking-wide">Estimated total</p>
            <p className="text-2xl font-bold">${total.toLocaleString()}</p>
          </div>
          <p className="text-xs text-blue-200 text-right max-w-[180px] leading-relaxed">
            Estimate only. Final pricing confirmed by our events team.
          </p>
        </div>
      )}

      {/* Notes */}
      <Field label="Anything else we should know?">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Special requests, questions, AV needs, catering thoughts…"
          className={`${input} resize-none`} />
      </Field>

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-6 py-3 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-100 transition-colors">
          ← Back
        </button>
        <button onClick={() => { void onSubmit(); }}
          className="px-8 py-3 rounded-xl bg-[#00205B] text-white font-semibold text-sm hover:bg-[#001a4a] transition-colors">
          Send Request →
        </button>
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const input = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00abc9]/30 focus:border-[#00abc9] transition-colors";

// ─── Main page ────────────────────────────────────────────────────────────────

interface ReserveClientProps {
  initialContact?: { name: string; email: string; phone: string; org: string };
}

export default function ReserveClient({ initialContact }: ReserveClientProps) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [bookingNumber, setBookingNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [contact, setContact] = useState<ContactInfo>({
    name: initialContact?.name ?? "",
    email: initialContact?.email ?? "",
    phone: initialContact?.phone ?? "",
    org: initialContact?.org ?? "",
    eventName: "",
    isNonProfit: false,
  });

  const [spaceMode, setSpaceMode] = useState<SpaceMode>("single");
  const [breakoutGroupSize, setBreakoutGroupSize] = useState(30);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [defaultHeadcount, setDefaultHeadcount] = useState(50);
  const [days, setDays] = useState<DayConfig[]>([]);
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, days, spaceMode, notes }),
      });
      const data = await res.json();
      if (data.bookingNumber) setBookingNumber(data.bookingNumber);
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setStep(2);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fafc] to-white">
      {/* Header */}
      <div className="bg-[#00205B] text-white py-6 px-4 mb-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#00abc9] mb-1">BX Community Center</p>
          <h1 className="text-2xl font-bold">Reserve a Space</h1>
          <p className="text-blue-200 text-sm mt-1">Build your event, see real availability, and send your request — all in one place.</p>
        </div>
      </div>

      <div className="px-4 pb-16">
        <StepBar step={step} />

        {step === 0 && (
          <ContactStep
            contact={contact}
            onChange={p => setContact(c => ({ ...c, ...p }))}
            spaceMode={spaceMode}
            onSpaceMode={setSpaceMode}
            onNext={() => setStep(1)}
            isSignedIn={!!initialContact}
          />
        )}
        {step === 1 && (
          <BuilderStep
            days={days} setDays={setDays}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            defaultHeadcount={defaultHeadcount} setDefaultHeadcount={setDefaultHeadcount}
            spaceMode={spaceMode}
            breakoutGroupSize={breakoutGroupSize} setBreakoutGroupSize={setBreakoutGroupSize}
            isNP={contact.isNonProfit}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <ReviewStep
            contact={contact}
            days={days}
            isNP={contact.isNonProfit}
            notes={notes} setNotes={setNotes}
            onBack={() => setStep(1)}
            onSubmit={handleSubmit}
            submitted={submitted}
            bookingNumber={bookingNumber}
          />
        )}
      </div>
    </div>
  );
}
