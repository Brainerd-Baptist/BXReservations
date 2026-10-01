"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/field";
import { useToast } from "./Toast";
import { ROOMS } from "@/lib/rooms";
import { formatYmd } from "@/lib/dates";

type Room = { roomId: string; setup: string; customSetup: string; requested?: boolean; role?: string };
type Day = { date: string; included?: boolean; headcount?: number; customStart?: string; customEnd?: string; timeSlot?: string; rooms?: Room[] };
type Details = {
  id: string; status: string | null; event_name: string | null; contact_name: string | null; contact_email: string | null;
  contact_phone: string | null; contact_org: string | null; notes: string | null; is_non_profit: boolean | null; days: Day[];
};
type Conflict = { date: string; roomId: string | null; kind: string; level: "hard" | "soft"; message: string };
type Review = { conflicts: Conflict[]; note: string | null; approved_at: string } | null;
type Resp = { reservation: Details; staff: boolean; canEdit: boolean; canRequestChange: boolean; review?: Review };

const SLOTS = [
  { v: "any", l: "Any time" }, { v: "morning", l: "Morning (8–12)" }, { v: "afternoon", l: "Afternoon (12–5)" }, { v: "evening", l: "Evening (5–10)" },
];
const SETUPS = [
  ["", "—"], ["theater", "Theater"], ["banquet", "Banquet"], ["classroom", "Classroom"], ["reception", "Reception"],
  ["cocktail", "Cocktail"], ["boardroom", "Boardroom"], ["custom", "Custom"],
] as const;

async function jsonOrThrow(res: Response) {
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as { error?: string }).error ?? `Error ${res.status}`);
  return d;
}

/**
 * "Edit details" for a booking. Organizers edit names, contact info,
 * headcount and notes, and ask for date/time/room changes. Staff edit
 * everything, including the schedule. `onSaved` lets the admin list refresh;
 * otherwise the page re-renders.
 */
export default function EditBooking({ reservationId, onSaved, compact = false }: { reservationId: string; onSaved?: () => void; compact?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  const [mode, setMode] = useState<null | "edit" | "request">(null);
  const [f, setF] = useState<Details | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [req, setReq] = useState<{ what: string[]; message: string }>({ what: [], message: "" });
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [ackNote, setAckNote] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`/api/reservations/${reservationId}/details`).then(jsonOrThrow).then((d) => { if (live) setData(d); }).catch(() => {});
    return () => { live = false; };
  }, [reservationId]);

  if (!data || (!data.canEdit && !data.canRequestChange)) return null;
  const staff = data.staff;

  function startEdit() {
    setF(JSON.parse(JSON.stringify(data!.reservation)));
    setErr(null);
    setMode("edit");
  }
  const up = (patch: Partial<Details>) => setF((prev) => (prev ? { ...prev, ...patch } : prev));
  const upDay = (i: number, patch: Partial<Day>) => setF((prev) => prev ? { ...prev, days: prev.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) } : prev);

  async function save(e: React.FormEvent | null, acknowledge = false) {
    e?.preventDefault();
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        event_name: f.event_name ?? "", contact_name: f.contact_name ?? "", contact_phone: f.contact_phone ?? "",
        contact_org: f.contact_org ?? "", notes: f.notes ?? "",
        days: f.days.map((d) => ({ ...d, rooms: d.rooms ?? [] })),
      };
      if (staff) { body.contact_email = f.contact_email ?? ""; body.is_non_profit = !!f.is_non_profit; }
      if (acknowledge) { body.acknowledge_conflicts = true; body.conflict_note = ackNote; }
      const res = await fetch(`/api/reservations/${reservationId}/details`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.status === 409) {
        const c = await res.json().catch(() => ({}));
        setConflicts((c as { conflicts?: Conflict[] }).conflicts ?? []);
        return;
      }
      const d = await jsonOrThrow(res);
      setConflicts(null); setAckNote("");
      toast(d.changed?.length ? "Booking updated." : "No changes to save.", "success");
      setMode(null);
      const fresh = await jsonOrThrow(await fetch(`/api/reservations/${reservationId}/details`));
      setData(fresh);
      if (onSaved) onSaved(); else router.refresh();
    } catch (e2) { setErr((e2 as Error).message); }
    finally { setBusy(false); }
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await jsonOrThrow(await fetch(`/api/reservations/${reservationId}/change-request`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req),
      }));
      toast("Sent to the BX team — you'll hear back in Messages.", "success");
      setMode(null); setReq({ what: [], message: "" });
      router.refresh();
    } catch (e2) { setErr((e2 as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className={compact ? "" : "mb-4"}>
      {staff && data.review && mode === null && (
        <div className="bx-tone-amber border rounded-xl p-3 mb-2 text-xs">
          <p className="font-semibold">Overlap approved {new Date(data.review.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">{data.review.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
          {data.review.note && <p className="mt-1 italic">“{data.review.note}”</p>}
        </div>
      )}
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          {data.canEdit && <Button size="sm" variant="secondary" onClick={startEdit}>Edit details</Button>}
          {data.canRequestChange && <Button size="sm" variant="ghost" onClick={() => { setErr(null); setMode("request"); }}>Request date, time or room change</Button>}
        </div>
      )}

      {mode === "edit" && f && (
        <form onSubmit={save} className="bx-well rounded-xl p-4 space-y-4" aria-label="Edit booking details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Event name" required className="sm:col-span-2">
              <Input value={f.event_name ?? ""} onChange={(e) => up({ event_name: e.target.value })} required minLength={2} maxLength={120} />
            </Field>
            <Field label="Contact name" required>
              <Input value={f.contact_name ?? ""} onChange={(e) => up({ contact_name: e.target.value })} required minLength={2} maxLength={120} autoComplete="name" />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={f.contact_phone ?? ""} onChange={(e) => up({ contact_phone: e.target.value })} maxLength={40} autoComplete="tel" />
            </Field>
            <Field label="Organization">
              <Input value={f.contact_org ?? ""} onChange={(e) => up({ contact_org: e.target.value })} maxLength={120} />
            </Field>
            {staff ? (
              <Field label="Contact email" hint="Changing this changes who can see the booking">
                <Input type="email" value={f.contact_email ?? ""} onChange={(e) => up({ contact_email: e.target.value })} required />
              </Field>
            ) : (
              <Field label="Contact email" hint="Message the BX team to change this">
                <Input type="email" value={f.contact_email ?? ""} readOnly disabled />
              </Field>
            )}
            {staff && (
              <label className="flex items-center gap-2 text-sm text-parchment sm:col-span-2">
                <input type="checkbox" checked={!!f.is_non_profit} onChange={(e) => up({ is_non_profit: e.target.checked })} className="w-4 h-4" />
                Non-profit organization
              </label>
            )}
          </div>

          {/* Days */}
          {f.days.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-parchment mb-1">{staff ? "Schedule" : "Attendance"}</legend>
              {f.days.map((d, i) => (
                <div key={i} className="bx-glass-flat rounded-xl p-3 space-y-3">
                  {staff ? (
                    <>
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                        <Field label="Date" className="col-span-2 sm:col-span-1"><Input type="date" value={d.date} onChange={(e) => upDay(i, { date: e.target.value })} required /></Field>
                        <Field label="Time of day" className="col-span-2 sm:col-span-1">
                          <Select value={d.timeSlot ?? "any"} onChange={(e) => upDay(i, { timeSlot: e.target.value })}>
                            {SLOTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                          </Select>
                        </Field>
                        <Field label="Start"><Input type="time" value={d.customStart ?? ""} onChange={(e) => upDay(i, { customStart: e.target.value })} /></Field>
                        <Field label="End"><Input type="time" value={d.customEnd ?? ""} onChange={(e) => upDay(i, { customEnd: e.target.value })} /></Field>
                      </div>
                      <div className="grid gap-3 grid-cols-2">
                        <Field label="Headcount"><Input type="number" min="1" inputMode="numeric" value={d.headcount ?? ""} onChange={(e) => upDay(i, { headcount: Number(e.target.value) })} /></Field>
                        <label className="flex items-end gap-2 pb-3 text-sm text-parchment">
                          <input type="checkbox" checked={d.included !== false} onChange={(e) => upDay(i, { included: e.target.checked })} className="w-4 h-4" />
                          Include this day
                        </label>
                      </div>
                      <RoomsEditor rooms={d.rooms ?? []} onChange={(rooms) => upDay(i, { rooms })} />
                      {f.days.length > 1 && (
                        <button type="button" className="text-xs underline" style={{ color: "var(--bx-clay)" }}
                          onClick={() => setF((p) => p ? { ...p, days: p.days.filter((_, j) => j !== i) } : p)}>Remove this day</button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-sm text-parchment pb-3">{formatYmd(d.date, { weekday: "short", month: "short", day: "numeric" })}</p>
                      <Field label="Headcount" className="w-32">
                        <Input type="number" min="1" inputMode="numeric" value={d.headcount ?? ""} onChange={(e) => upDay(i, { headcount: Number(e.target.value) })} />
                      </Field>
                    </div>
                  )}
                </div>
              ))}
              {staff && (
                <Button type="button" size="sm" variant="secondary"
                  onClick={() => setF((p) => p ? { ...p, days: [...p.days, { ...p.days[p.days.length - 1], date: "" }] } : p)}>+ Add a day</Button>
              )}
            </fieldset>
          )}

          <Field label="Notes">
            <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => up({ notes: e.target.value })} maxLength={4000} />
          </Field>

          {!staff && <p className="text-xs text-slate">To change dates, times or rooms, use “Request a change” — the BX team will confirm availability.</p>}
          {err && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--bx-clay)" }}>{err}</p>}

          {conflicts && conflicts.length > 0 ? (
            <div role="alertdialog" aria-labelledby="bx-conflict-title" aria-describedby="bx-conflict-list"
              className={`${conflicts.some((c) => c.level === "hard") ? "bx-tone-red" : "bx-tone-amber"} border rounded-xl p-4 space-y-3`}>
              <p id="bx-conflict-title" className="font-semibold">
                {conflicts.some((c) => c.level === "hard") ? "This schedule overlaps something already booked" : "Check before saving"}
              </p>
              <ul id="bx-conflict-list" className="text-sm space-y-1 list-disc pl-5">
                {conflicts.map((c, i) => (
                  <li key={i}><strong>{formatYmd(c.date, { weekday: "short", month: "short", day: "numeric" })}:</strong> {c.message}</li>
                ))}
              </ul>
              <Field label="Why it's OK (optional)" hint="Saved in the booking history, e.g. 'Same group — shared setup'">
                <Input value={ackNote} onChange={(e) => setAckNote(e.target.value)} maxLength={500} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setConflicts(null)}>Go back and adjust</Button>
                <Button type="button" size="sm" variant={conflicts.some((c) => c.level === "hard") ? "danger" : "primary"} loading={busy}
                  onClick={() => save(null, true)}>Approve overlap and save</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={busy}>Save changes</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setConflicts(null); setMode(null); }}>Cancel</Button>
            </div>
          )}
        </form>
      )}

      {mode === "request" && (
        <form onSubmit={sendRequest} className="bx-well rounded-xl p-4 space-y-3" aria-label="Request a change">
          <fieldset>
            <legend className="text-sm font-semibold text-parchment mb-2">What would you like to change?</legend>
            <div className="flex flex-wrap gap-2">
              {[["dates", "Dates"], ["times", "Times"], ["rooms", "Rooms"], ["other", "Something else"]].map(([v, l]) => {
                const on = req.what.includes(v);
                return (
                  <button key={v} type="button" aria-pressed={on}
                    onClick={() => setReq((p) => ({ ...p, what: on ? p.what.filter((x) => x !== v) : [...p.what, v] }))}
                    className={`bx-btn bx-btn--sm ${on ? "bx-btn--primary" : "bx-btn--secondary"}`}>{l}</button>
                );
              })}
            </div>
          </fieldset>
          <Field label="Details" required hint="e.g. Move Saturday to Sunday 1–5pm, and add CrossPointe B">
            <Textarea rows={3} value={req.message} onChange={(e) => setReq((p) => ({ ...p, message: e.target.value }))} required maxLength={2000} />
          </Field>
          {err && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--bx-clay)" }}>{err}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy}>Send request</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function RoomsEditor({ rooms, onChange }: { rooms: Room[]; onChange: (r: Room[]) => void }) {
  // Every room in the list is booked (`requested` only marks one that had a conflict)
  const chosen = rooms;
  const has = (id: string) => chosen.find((r) => r.roomId === id);
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Rooms</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {ROOMS.map((room) => {
          const r = has(room.id);
          return (
            <div key={room.id} className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2 flex-1 min-w-0 text-parchment">
                <input type="checkbox" className="w-4 h-4" checked={!!r}
                  onChange={(e) => onChange(e.target.checked
                    ? [...chosen, { roomId: room.id, setup: "", customSetup: "", requested: false, role: chosen.length ? "extra" : "main" }]
                    : chosen.filter((x) => x.roomId !== room.id))} />
                <span className="truncate">{room.name}</span>
              </label>
              {r && (
                <select aria-label={`${room.name} setup`} className="bx-input bx-input--sm w-32" value={r.setup}
                  onChange={(e) => onChange(chosen.map((x) => (x.roomId === room.id ? { ...x, setup: e.target.value } : x)))}>
                  {SETUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
