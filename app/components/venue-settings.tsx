"use client";

// Admin → Settings → Venue info: the facts attendees are told in the event packet.

import { useEffect, useState } from "react";
import { VENUE_FIELDS, type VenueInfo, type VenueKey } from "@/lib/venue";

export default function VenueSettings() {
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [draft, setDraft] = useState<VenueInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/venue-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load venue info"))))
      .then((d) => { if (live) { setVenue(d.venue); setDraft(d.venue); } })
      .catch((e) => live && setMsg(e.message));
    return () => { live = false; };
  }, []);

  const dirty = !!venue && !!draft && VENUE_FIELDS.some((f) => venue[f.key] !== draft[f.key]);

  const save = async () => {
    if (!draft) return;
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/venue-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venue: draft }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Couldn't save");
      setVenue(d.venue); setDraft(d.venue); setMsg("Saved — the next packet anyone downloads uses this.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save");
    } finally { setSaving(false); }
  };

  return (
    <section className="bx-glass rounded-xl p-5 space-y-4" aria-label="Venue info">
      <div>
        <p className="text-xs font-semibold text-slate uppercase tracking-widest">Venue info for attendees</p>
        <p className="text-sm text-slate mt-1">Printed on the event packet planners send to their attendees: cover, Getting here page, footer. Blank fields are left off.</p>
      </div>
      {!draft ? (
        <p className="text-sm text-slate">{msg ?? "Loading…"}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {VENUE_FIELDS.map((f) => (
            <label key={f.key} className={`block ${f.multiline ? "md:col-span-2" : ""}`}>
              <span className="block text-xs font-semibold text-parchment mb-1">{f.label}</span>
              {f.multiline ? (
                <textarea
                  rows={3}
                  value={draft[f.key]}
                  placeholder={f.hint}
                  onChange={(e) => setDraft({ ...draft, [f.key as VenueKey]: e.target.value })}
                  className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-sm px-3 py-2"
                />
              ) : (
                <input
                  value={draft[f.key]}
                  placeholder={f.hint}
                  onChange={(e) => setDraft({ ...draft, [f.key as VenueKey]: e.target.value })}
                  className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-sm px-3 py-2"
                />
              )}
              <span className="block text-[11px] text-slate mt-1">{f.hint}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--bbc-blue)] text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save venue info"}
        </button>
        {msg && draft && <span className="text-sm text-slate">{msg}</span>}
      </div>
    </section>
  );
}
