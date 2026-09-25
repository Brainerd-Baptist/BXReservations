
"use client";
import { useState, useEffect, useCallback } from "react";
import { BlackoutRule, isDateBlackedOut, isSlotBlackedOut, blackoutReason } from "@/lib/blackouts";
import { COLLAB_ROLE_LABELS, COLLAB_ROLE_DESCRIPTIONS, type CollabRole } from "@/lib/roles";
import { ROOMS, type Room } from "@/lib/rooms";
import { RoomCard } from "@/app/components/room-card";
import { RoomLightbox } from "@/app/components/room-lightbox";

// ─── Types ────────────────────────────────────────────────────────────────────

type Signal = "available" | "ask" | "unavailable" | "loading";
type SetupId = "theater" | "banquet" | "classroom" | "reception" | "cocktail" | "boardroom" | "custom" | "";
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
  customStart: string;
  customEnd: string;
  rooms: RoomSelection[];
  timeSlot: "any" | "morning" | "afternoon" | "evening";
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
  label: string; style: React.CSSProperties;
} | null {
  if (headcount <= 0) return null;
  const ratio = headcount / capacityTheater;
  if (headcount > capacityTheater) {
    return { label: "Too small", style: { background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" } };
  }
  if (ratio >= 0.6 && ratio <= 1.0) {
    return { label: "Best fit", style: { background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" } };
  }
  if (ratio >= 0.25 && ratio < 0.6) {
    return { label: "Good fit", style: { background: "color-mix(in srgb, var(--bx-brass) 12%, transparent)", color: "var(--bx-brass)", border: "1px solid color-mix(in srgb, var(--bx-brass) 30%, transparent)" } };
  }
  return { label: "Oversized", style: { background: "rgba(0,0,0,0.25)", color: "var(--bx-slate)", border: "1px solid rgba(255,255,255,0.1)" } };
}

function signalBadge(sig: Signal) {
  switch (sig) {
    case "available":   return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Available</span>;
    case "ask":         return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Ask Us</span>;
    case "unavailable": return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Unavailable</span>;
    default:            return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-parchment/10 text-slate animate-pulse">Checking…</span>;
  }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["About You", "Build Your Event", "Review"] as const;

function StepBar({ step }: { step: number }) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0 ${
                i < step  ? "bg-brass border-brass text-white" :
                i === step ? "bg-ink-soft border-brass text-brass" :
                             "bg-ink border-parchment/20 text-slate"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight font-medium ${i === step ? "text-parchment" : "text-slate"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 mx-1 transition-all ${i < step ? "bg-brass" : "bg-parchment/15"}`} />
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
      <div className="bg-ink-soft rounded-2xl border border-parchment/10 shadow-sm p-6 mb-6">
      <h2 className="text-2xl font-bold text-parchment mb-1">Let's get started</h2>
      <p className="text-slate mb-4">Tell us a bit about you and your event.</p>

      {/* Returning-user nudge — only shown when signed out */}
      {!isSignedIn && (
        <div className="flex items-center justify-between bg-ink border border-parchment/15 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-slate">Already have an account?</p>
          <a
            href="/login?next=/reserve"
            className="text-sm font-semibold text-brass hover:text-brass/80 transition-colors"
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
          <p className="text-sm font-medium text-parchment mb-2">How many spaces do you need? <span className="text-red-400">*</span></p>
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
                    ? "border-brass bg-brass/5"
                    : "border-parchment/15 bg-ink-soft hover:border-parchment/30"
                }`}>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${spaceMode === opt.mode ? "text-parchment" : "text-parchment"}`}>{opt.label}</p>
                  <p className="text-xs text-slate">{opt.desc}</p>
                </div>
                {spaceMode === opt.mode && <span className="text-brass font-bold text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onChange({ isNonProfit: !contact.isNonProfit })}
            className={`w-10 h-6 rounded-full relative transition-colors ${contact.isNonProfit ? "bg-brass" : "bg-parchment/20"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-ink-soft rounded-full shadow transition-transform ${contact.isNonProfit ? "translate-x-4" : ""}`} />
          </button>
          <span className="text-sm text-parchment">We are a non-profit organization</span>
        </div>
        {contact.isNonProfit && (
          <p className="text-xs text-brass -mt-2 pl-14">Non-profit rates will be applied to your estimate.</p>
        )}
      </div>

      </div>{/* end white card */}

      <div className="mt-6 flex justify-end">
        <button onClick={onNext} disabled={!valid}
          className="px-8 py-3 rounded-xl bg-brass text-white font-semibold text-sm disabled:opacity-40 hover:bg-brass/90 transition-colors">
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
  isNP, blackoutRules, onBack, onNext,
}: {
  days: DayConfig[];
  setDays: React.Dispatch<React.SetStateAction<DayConfig[]>>;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string;   setEndDate:   (v: string) => void;
  defaultHeadcount: number; setDefaultHeadcount: (v: number) => void;
  spaceMode: SpaceMode;
  breakoutGroupSize: number; setBreakoutGroupSize: (v: number) => void;
  isNP: boolean;
  blackoutRules: BlackoutRule[];
  onBack: () => void; onNext: () => void;
}) {
  // Fetch availability whenever included days change
  const fetchAvailability = useCallback(async (day: DayConfig) => {
    if (day.availabilityFetched) return;
    const roomIds = ROOMS.map(r => r.id).join(",");
    try {
      const res = await fetch(`/api/availability?date=${day.date}&rooms=${roomIds}&timeSlot=${day.timeSlot}`);
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
      return dates.map(date => {
        const isBlocked = isDateBlackedOut(date, blackoutRules);
        return byDate[date] ?? {
        date, included: !isBlocked,
        headcount: defaultHeadcount,
        customStart: "08:00", customEnd: "22:00",
        rooms: [],
        availability: Object.fromEntries(ROOMS.map(r => [r.id, "loading" as Signal])),
        availabilityFetched: false,
      };});
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
      <h2 className="text-2xl font-bold text-parchment mb-1">Build your event</h2>
      <p className="text-slate mb-6">Set your dates, configure each day, and choose your spaces.</p>

      {/* Date range + default headcount */}
      <div className="bg-ink-soft border border-parchment/10 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 sm:gap-4 overflow-hidden">
          <Field label="Start date" required>
            <input type="date" value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                // Default end date to start date if unset or before new start
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
              className={`${input} min-w-0`} />
          </Field>
          <Field label="End date" required>
            <input type="date" value={endDate} min={startDate}
              onChange={e => setEndDate(e.target.value)} className={`${input} min-w-0`} />
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
        <div className="text-center py-16 text-slate">
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
              onTimeSlot={slot => updateDay(day.date, { timeSlot: slot, availabilityFetched: false, availability: Object.fromEntries(ROOMS.map(r => [r.id, "loading" as Signal])) })}
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
              blackoutRules={blackoutRules}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      {total > 0 && (
        <div className="mt-6 bg-parchment text-ink rounded-2xl p-4 flex items-center justify-between">
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
        <button onClick={onBack}
          className="px-6 py-3 rounded-xl text-slate font-medium text-sm hover:bg-parchment/10 transition-colors">
          ← Back
        </button>
        <button onClick={onNext} disabled={!canContinue}
          className="px-8 py-3 rounded-xl bg-brass text-white font-semibold text-sm disabled:opacity-40 hover:bg-brass/90 transition-colors">
          Review & Request →
        </button>
      </div>
    </div>
  );
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  day, dayIdx, total, isNP, spaceMode, breakoutGroupSize, onBreakoutGroupSize,
  onToggleInclude, onHeadcount, onTimeSlot, onCustomTime,
  onToggleRoom, onUpdateRoom, onCopyToNext, onApplyToAll, blackoutRules,
}: {
  day: DayConfig; dayIdx: number; total: number; isNP: boolean;
  spaceMode: SpaceMode;
  breakoutGroupSize: number;
  onBreakoutGroupSize: (n: number) => void;
  onToggleInclude: () => void;
  onHeadcount: (n: number) => void;
  onTimeSlot: (slot: "any" | "morning" | "afternoon" | "evening") => void;
  onCustomTime: (start: string, end: string) => void;
  onToggleRoom: (roomId: string, role: "main" | "extra") => void;
  onUpdateRoom: (roomId: string, patch: Partial<RoomSelection>) => void;
  onCopyToNext: () => void;
  onApplyToAll: () => void;
  blackoutRules?: BlackoutRule[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);
  const isDayBlocked = !!(blackoutRules && isDateBlackedOut(day.date, blackoutRules));
  const est = dayEstimate(day, isNP);

  return (
    <div className={`rounded-2xl border transition-all ${isDayBlocked ? "border-red-200 bg-red-50" : day.included ? "border-parchment/15 bg-ink-soft shadow-sm" : "border-dashed border-parchment/15 bg-ink opacity-60"}`}>
      {isDayBlocked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-t-2xl border-b border-red-100 text-xs text-red-700 font-medium">
          <span>🚫</span>
          <span>{blackoutReason(day.date, null, blackoutRules ?? []) ?? "Not available"} — this date is not open for reservations</span>
        </div>
      )}
      {/* Day header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggleInclude(); }}
          title={day.included ? "Remove this day" : "Include this day"}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            day.included ? "bg-brass border-brass text-white" : "border-parchment/20 bg-ink"
          }`}
        >
          {day.included && <span className="text-xs font-bold">✓</span>}
        </button>
        <div className="flex-1">
          <p className="font-semibold text-parchment">{fmtDate(day.date)}</p>
          {day.included && (
            <p className="text-xs text-slate mt-0.5">
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
                className="text-xs px-2.5 py-1 rounded-lg bg-brass/5 border border-brass/30 text-brass hover:bg-brass hover:text-white font-medium whitespace-nowrap transition-colors active:scale-95">
                Copy to next ↓
              </button>
            )}
            {total > 1 && (
              <button onClick={onApplyToAll}
                className="text-xs text-slate hover:text-parchment font-medium whitespace-nowrap">
                Apply to all
              </button>
            )}
          </div>
        )}
        <span className="text-slate/40 text-sm">{expanded && day.included ? "▲" : "▼"}</span>
      </div>

      {/* Day body */}
      {expanded && day.included && (
        <div className="border-t border-parchment/10 px-5 py-4 space-y-5">
          {/* Headcount + time of day */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Headcount</label>
              <div className="flex items-center gap-2">
                <button onClick={() => onHeadcount(Math.max(1, day.headcount - 10))}
                  className="w-7 h-7 rounded-lg border border-parchment/15 text-slate hover:bg-parchment/5 font-bold">−</button>
                <input type="number" min={1} value={day.headcount}
                  onChange={e => onHeadcount(parseInt(e.target.value) || 1)}
                  className="w-16 text-center border border-parchment/15 rounded-lg py-1 text-sm bg-ink text-parchment" />
                <button onClick={() => onHeadcount(day.headcount + 10)}
                  className="w-7 h-7 rounded-lg border border-parchment/15 text-slate hover:bg-parchment/5 font-bold">+</button>
              </div>
            </div>
            <div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Time of day</label>
                <div className="flex gap-1 flex-wrap">
                  {(["any", "morning", "afternoon", "evening"] as const).map(slot => {
                    const slotLabels: Record<string, string> = {
                      any: "Any time",
                      morning: "Morning (8a–12p)",
                      afternoon: "Afternoon (12p–5p)",
                      evening: "Evening (5p–10p)",
                    };
                    const slotBlocked = slot !== "any" && blackoutRules && isSlotBlackedOut(day.date, slot, blackoutRules);
                    return (
                      <button
                        key={slot}
                        onClick={() => !slotBlocked && onTimeSlot(slot)}
                        disabled={!!slotBlocked}
                        title={slotBlocked ? blackoutReason(day.date, slot, blackoutRules ?? []) ?? "Not available" : undefined}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          slotBlocked
                            ? "bg-ink text-slate/40 cursor-not-allowed line-through"
                            : day.timeSlot === slot
                            ? "bg-parchment text-ink"
                            : "bg-parchment/10 text-slate hover:bg-parchment/20"
                        }`}
                      >
                        {slotLabels[slot]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Room grid — space-mode-aware */}
          <div className="space-y-5">
            {spaceMode === "main-plus" && (
              <div className="bg-brass/5 border border-brass/30 rounded-xl p-3">
                <p className="text-xs font-semibold text-parchment uppercase tracking-wide mb-2">Breakout calculator</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate block mb-1">People per breakout group</label>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => onBreakoutGroupSize(Math.max(5, breakoutGroupSize - 5))}
                        className="w-7 h-7 rounded-full bg-ink border border-parchment/15 text-slate text-sm font-bold hover:bg-parchment/5 flex items-center justify-center">−</button>
                      <span className="text-base font-semibold text-parchment w-8 text-center">{breakoutGroupSize}</span>
                      <button type="button"
                        onClick={() => onBreakoutGroupSize(Math.min(200, breakoutGroupSize + 5))}
                        className="w-7 h-7 rounded-full bg-ink border border-parchment/15 text-slate text-sm font-bold hover:bg-parchment/5 flex items-center justify-center">+</button>
                    </div>
                  </div>
                  {day.headcount > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate">Rooms needed</p>
                      <p className="text-2xl font-bold text-parchment">{Math.ceil(day.headcount / breakoutGroupSize)}</p>
                      <p className="text-[10px] text-slate">{day.headcount} people ÷ {breakoutGroupSize}/group</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main / single space picker */}
            {(spaceMode === "single" || spaceMode === "main-plus") && (
              <div>
                <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: "var(--bx-slate)" }}>
                  {spaceMode === "main-plus" ? "🏛️ Main Space" : "Select your space"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ROOMS.map(room => {
                    const sig = day.availability[room.id] ?? "loading";
                    const sel = day.rooms.find(r => r.roomId === room.id);
                    const isSelected = !!sel && sel.role === "main";
                    const mainPicked = day.rooms.find(r => r.role === "main");
                    const isDisabled = spaceMode === "single" && !!mainPicked && mainPicked.roomId !== room.id;
                    const tag = getRoomTag(day.headcount, room.capacityTheater, room.capacityBanquet);
                    return (
                      <div key={room.id}>
                        <RoomCard
                          room={room}
                          signal={sig}
                          isSelected={isSelected}
                          isDisabled={isDisabled}
                          isNP={isNP}
                          tag={tag}
                          onToggle={() => onToggleRoom(room.id, "main")}
                          onPreview={() => setPreviewRoom(room)}
                          role="main"
                        />
                        {isSelected && !sel?.requested && (
                          <div className="mt-2 px-3 py-3 rounded-xl border" style={{ background: "color-mix(in srgb, var(--bx-brass) 5%, transparent)", borderColor: "color-mix(in srgb, var(--bx-brass) 20%, transparent)" }}>
                            <p className="text-xs font-medium mb-2" style={{ color: "var(--bx-slate)" }}>Setup style</p>
                            <div className="flex flex-wrap gap-1">
                              {(room.setups as readonly string[]).map(sid => {
                                const s = SETUP_STYLES.find(x => x.id === sid);
                                if (!s) return null;
                                return (
                                  <button key={sid} onClick={() => onUpdateRoom(room.id, { setup: sid as SetupId })} title={s.desc}
                                    className="px-2 py-1 rounded-md text-xs font-medium transition-colors"
                                    style={sel?.setup === sid
                                      ? { background: "var(--bx-parchment)", color: "var(--bx-ink)" }
                                      : { background: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)", color: "var(--bx-slate)" }
                                    }>
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
                          <p className="mt-1 text-xs italic" style={{ color: "#d97706" }}>This space may be in conflict. We will review and follow up with you.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extra / additional spaces (main-plus and multiple modes) */}
            {(spaceMode === "main-plus" || spaceMode === "multiple") && (
              <div>
                <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: "var(--bx-slate)" }}>
                  {spaceMode === "main-plus" ? "➕ Additional Spaces" : "Select spaces for this day"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ROOMS.map(room => {
                    const sig = day.availability[room.id] ?? "loading";
                    const sel = day.rooms.find(r => r.roomId === room.id);
                    if (spaceMode === "main-plus" && sel?.role === "main") return null;
                    const isSelected = !!sel && sel.role === "extra";
                    const effectiveHC = spaceMode === "main-plus" ? breakoutGroupSize : day.headcount;
                    const tag = getRoomTag(effectiveHC, room.capacityTheater, room.capacityBanquet);
                    return (
                      <div key={room.id}>
                        <RoomCard
                          room={room}
                          signal={sig}
                          isSelected={isSelected}
                          isDisabled={false}
                          isNP={isNP}
                          tag={tag}
                          onToggle={() => onToggleRoom(room.id, "extra")}
                          onPreview={() => setPreviewRoom(room)}
                          role="extra"
                        />
                        {isSelected && !sel?.requested && (
                          <div className="mt-2 px-3 py-3 rounded-xl border" style={{ background: "color-mix(in srgb, var(--bx-brass) 5%, transparent)", borderColor: "color-mix(in srgb, var(--bx-brass) 20%, transparent)" }}>
                            <p className="text-xs font-medium mb-2" style={{ color: "var(--bx-slate)" }}>Setup style</p>
                            <div className="flex flex-wrap gap-1">
                              {(room.setups as readonly string[]).map(sid => {
                                const s = SETUP_STYLES.find(x => x.id === sid);
                                if (!s) return null;
                                return (
                                  <button key={sid} onClick={() => onUpdateRoom(room.id, { setup: sid as SetupId })} title={s.desc}
                                    className="px-2 py-1 rounded-md text-xs font-medium transition-colors"
                                    style={sel?.setup === sid
                                      ? { background: "var(--bx-parchment)", color: "var(--bx-ink)" }
                                      : { background: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)", color: "var(--bx-slate)" }
                                    }>
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
                          <p className="mt-1 text-xs italic" style={{ color: "#d97706" }}>This space may be in conflict. We will review and follow up with you.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Room lightbox — renders on top when a card is previewed */}
      <RoomLightbox
        room={previewRoom}
        isSelected={previewRoom ? !!day.rooms.find(r => r.roomId === previewRoom.id) : false}
        isNP={isNP}
        onClose={() => setPreviewRoom(null)}
        onToggle={() => {
          if (!previewRoom) return;
          const sel = day.rooms.find(r => r.roomId === previewRoom.id);
          const role = sel?.role ?? "main";
          onToggleRoom(previewRoom.id, role as "main" | "extra");
          setPreviewRoom(null);
        }}
      />
    </div>
  );
}

// ─── Step 2: Review ───────────────────────────────────────────────────────────

function ReviewStep({
  contact, days, isNP, notes, setNotes, onBack, onSubmit, submitted, submitting, bookingNumber, submitError, reservationId,
}: {
  contact: ContactInfo;
  days: DayConfig[];
  isNP: boolean;
  notes: string; setNotes: (v: string) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  submitted: boolean;
  submitting: boolean;
  bookingNumber: string;
  submitError: string;
  reservationId?: string;
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
        <h2 className="text-2xl font-bold text-parchment mb-2">Request received!</h2>
        <p className="text-slate mb-4">
          Thank you, {contact.name.split(" ")[0]}. Our team will review your request for <strong>{contact.eventName}</strong> and follow up within 1–2 business days.
        </p>
        {bookingNumber && (
          <div className="inline-block bg-brass/5 border border-brass/30 rounded-2xl px-6 py-4 mb-6">
            <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">Your booking reference</p>
            <p className="text-2xl font-bold text-parchment tracking-widest font-mono">{bookingNumber}</p>
            <p className="text-xs text-slate mt-1">Save this number — you&apos;ll need it to upload your liability insurance.</p>
          </div>
        )}
        <p className="text-sm text-slate">A confirmation has been sent to {contact.email}.</p>

        {/* ── Sign-in nudge ─────────────────────────────────── */}
        <div className="mt-6 p-4 bg-ink-soft border border-brass/30 rounded-2xl text-left flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-brass/5 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-brass" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-parchment mb-0.5">Save this to your account</p>
            <p className="text-sm text-slate mb-3">
              Create a free account to track your booking status, upload your insurance, and see updates — no need to dig through email.
            </p>
            <a
              href="/login?next=/account"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink bg-parchment hover:bg-parchment/90 px-4 py-2 rounded-xl transition-colors"
            >
              Sign in or create account
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* ── Share this reservation ─────────────────────── */}
        {reservationId && (
          <ShareSection reservationId={reservationId} />
        )}

        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
          <p className="text-sm font-semibold text-amber-800 mb-1">Next step: Upload your liability insurance</p>
          <p className="text-sm text-amber-700">To complete your booking, upload a Certificate of Insurance (COI) showing Brainerd Baptist Church as an Additional Insured. We&apos;ll send you a link via email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-parchment mb-1">Review your request</h2>
      <p className="text-slate mb-6">Everything look right? Add any notes, then send your request.</p>

      {/* Contact summary */}
      <div className="bg-ink rounded-2xl p-4 mb-4 border border-parchment/10">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">About you</p>
        <p className="font-semibold text-parchment">{contact.name} · {contact.org}</p>
        <p className="text-sm text-slate">{contact.email} · {contact.phone}</p>
        {isNP && <p className="text-xs text-brass mt-1">Non-profit rates applied</p>}
      </div>

      {/* Event summary */}
      <div className="bg-ink rounded-2xl p-4 mb-4 border border-parchment/10">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Event</p>
        <p className="font-semibold text-parchment text-lg">{contact.eventName}</p>
        <p className="text-sm text-slate">
          {activeDays.length === 1
            ? fmtDate(activeDays[0].date)
            : `${fmtShortDate(activeDays[0].date)} – ${fmtShortDate(activeDays[activeDays.length - 1].date)}`}
          {" · "}{activeDays.length} day{activeDays.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Days breakdown */}
      <div className="space-y-3 mb-4">
        {activeDays.map(day => {
          const slotLabel: Record<string, string> = { any: "Any time", morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
          const confirmed = day.rooms.filter(r => !r.requested);
          const requested = day.rooms.filter(r => r.requested);
          return (
            <div key={day.date} className="bg-ink-soft border border-parchment/15 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-parchment text-sm">{fmtDate(day.date)}</p>
                <span className="text-xs text-slate">{slotLabel[day.timeSlot] ?? "Any time"} · {day.headcount} people</span>
              </div>
              {confirmed.length > 0 && (
                <div className="space-y-1 mb-2">
                  {confirmed.map(r => {
                    const room = ROOMS.find(ro => ro.id === r.roomId);
                    const setup = SETUP_STYLES.find(s => s.id === r.setup);
                    return (
                      <div key={r.roomId} className="flex items-center gap-2 text-sm">
                        <span className="text-brass">✓</span>
                        <span className="text-parchment">{room?.name}</span>
                        {setup && <span className="text-xs text-slate">— {setup.label}</span>}
                        {r.setup === "custom" && r.customSetup && (
                          <span className="text-xs text-slate italic">— {r.customSetup}</span>
                        )}
                        <span className="ml-auto text-xs font-medium text-slate">
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
        <div className="bg-parchment text-ink rounded-2xl p-4 mb-4 flex items-center justify-between">
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
        <button onClick={onBack} className="px-6 py-3 rounded-xl text-slate font-medium text-sm hover:bg-parchment/10 transition-colors">
          ← Back
        </button>
        <button onClick={() => { void onSubmit(); }} disabled={submitting}
          className="px-8 py-3 rounded-xl bg-parchment text-ink font-semibold text-sm hover:bg-parchment/90 disabled:opacity-60 transition-colors flex items-center gap-2">
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Sending…
            </>
          ) : "Send Request →"}
        </button>
      </div>
    </div>
  );
}


// ─── ShareSection: collaborator invite after booking confirmed ────────────────

interface MockCollaborator {
  id: string;
  email: string;
  role: CollabRole;
  display_name?: string;
  accepted: boolean;
}

function ShareSection({ reservationId }: { reservationId: string }) {
  const [inviteEmail, setInviteEmail]     = useState("");
  const [inviteRole, setInviteRole]       = useState<CollabRole>("viewer");
  const [inviting, setInviting]           = useState(false);
  const [inviteError, setInviteError]     = useState("");
  const [collaborators, setCollaborators] = useState<MockCollaborator[]>([]);
  const [revoking, setRevoking]           = useState<string | null>(null);

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setInviteError("Please enter a valid email address.");
      return;
    }
    if (collaborators.some(c => c.email === email)) {
      setInviteError("This person has already been invited.");
      return;
    }
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/collaborators/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId, email, role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInviteError((data as { error?: string }).error ?? "Failed to send invite. Try again.");
        return;
      }
      // Optimistic update
      setCollaborators(prev => [
        ...prev,
        { id: crypto.randomUUID(), email, role: inviteRole, accepted: false },
      ]);
      setInviteEmail("");
    } catch {
      setInviteError("Network error. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(collaboratorId: string) {
    setRevoking(collaboratorId);
    try {
      await fetch(`/api/collaborators/${collaboratorId}`, { method: "DELETE" });
      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
    } catch {
      // fail silently — optimistic remove already happened
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="mt-6 p-4 bg-ink-soft border border-brass/30 rounded-2xl text-left">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-brass shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
        <p className="text-sm font-semibold text-parchment">Share this reservation</p>
      </div>
      <p className="text-xs text-slate mb-4">
        Invite a co-organizer or viewer. They&apos;ll get an email with a link to access the reservation.
      </p>

      {/* Invite form */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          type="email"
          value={inviteEmail}
          onChange={e => { setInviteEmail(e.target.value); setInviteError(""); }}
          onKeyDown={e => { if (e.key === "Enter") void handleInvite(); }}
          placeholder="colleague@example.com"
          className="flex-1 border border-parchment/20 rounded-xl px-3 py-2 text-sm bg-ink text-parchment placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition-colors"
        />
        <select
          value={inviteRole}
          onChange={e => setInviteRole(e.target.value as CollabRole)}
          className="border border-parchment/20 rounded-xl px-3 py-2 text-sm bg-ink text-parchment focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition-colors"
        >
          {(["co_owner", "viewer"] as const).map(role => (
            <option key={role} value={role}>{COLLAB_ROLE_LABELS[role]}</option>
          ))}
        </select>
        <button
          onClick={() => { void handleInvite(); }}
          disabled={inviting || !inviteEmail.trim()}
          className="px-4 py-2 rounded-xl bg-brass text-ink text-sm font-semibold hover:bg-brass/90 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {inviting ? "Sending…" : "Invite"}
        </button>
      </div>

      {/* Role description hint */}
      <p className="text-xs text-slate mb-3 leading-relaxed">
        <span className="font-medium text-parchment/80">{COLLAB_ROLE_LABELS[inviteRole]}:</span>{" "}
        {COLLAB_ROLE_DESCRIPTIONS[inviteRole]}
      </p>

      {inviteError && (
        <p className="text-xs text-red-400 mb-3">{inviteError}</p>
      )}

      {/* Collaborator list */}
      {collaborators.length > 0 && (
        <div className="border-t border-parchment/10 pt-3 space-y-2">
          {collaborators.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-parchment truncate">
                  {c.display_name ?? c.email}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate">{COLLAB_ROLE_LABELS[c.role]}</span>
                  {!c.accepted && (
                    <span className="inline-flex items-center text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      Invite pending
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => void handleRevoke(c.id)}
                disabled={revoking === c.id}
                className="text-xs text-slate hover:text-red-400 disabled:opacity-50 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-parchment/5"
              >
                {revoking === c.id ? "Removing…" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-parchment mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const input = "w-full border border-parchment/20 rounded-xl px-3 py-2.5 text-sm bg-ink text-parchment placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition-colors";

// ─── Main page ────────────────────────────────────────────────────────────────

interface ReserveClientProps {
  initialContact?: { name: string; email: string; phone: string; org: string };
}

export default function ReserveClient({ initialContact }: ReserveClientProps) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [bookingNumber, setBookingNumber] = useState("");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
  const [blackoutRules, setBlackoutRules] = useState<BlackoutRule[]>([]);

  useEffect(() => {
    fetch("/api/blackouts")
      .then(r => r.json())
      .then((data: BlackoutRule[]) => setBlackoutRules(data))
      .catch(() => {}); // fail silently — no rules = no blocking
  }, []);

  function goToStep(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/submit-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, days, spaceMode, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong. Please try again or contact us directly.");
        return;
      }
      if (data.bookingNumber) setBookingNumber(data.bookingNumber);
      if (data.reservationId) setReservationId(data.reservationId as string);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden">
      <div className="bx-bloom" aria-hidden="true" />
      <div className="relative px-4 pt-20 pb-16">
        <StepBar step={step} />

        {step === 0 && (
          <div className="bx-fade-in">
          <ContactStep
            contact={contact}
            onChange={p => setContact(c => ({ ...c, ...p }))}
            spaceMode={spaceMode}
            onSpaceMode={setSpaceMode}
            onNext={() => goToStep(1)}
            isSignedIn={!!initialContact}
          />
          </div>
        )}
        {step === 1 && (
          <div className="bx-fade-in">
          <BuilderStep
            days={days} setDays={setDays}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            defaultHeadcount={defaultHeadcount} setDefaultHeadcount={setDefaultHeadcount}
            spaceMode={spaceMode}
            breakoutGroupSize={breakoutGroupSize} setBreakoutGroupSize={setBreakoutGroupSize}
            isNP={contact.isNonProfit}
            blackoutRules={blackoutRules}
            onBack={() => goToStep(0)}
            onNext={() => goToStep(2)}
          />
          </div>
        )}
        {step === 2 && (
          <div className="bx-fade-in">
          <ReviewStep
            contact={contact}
            days={days}
            isNP={contact.isNonProfit}
            notes={notes} setNotes={setNotes}
            onBack={() => goToStep(1)}
            onSubmit={handleSubmit}
            submitted={submitted}
            submitting={submitting}
            submitError={submitError}
            bookingNumber={bookingNumber}
            reservationId={reservationId ?? undefined}
          />
          </div>
        )}
      </div>
    </div>
  );
}
