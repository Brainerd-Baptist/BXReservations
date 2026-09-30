"use client";

// Admin → Settings → Room rate management.
// Shows the current per-hour rate for every room and lets staff update them.

import { useEffect, useState, useCallback } from "react";
import { ROOMS } from "@/lib/rooms";

type RateRow = {
  id: string;
  room_id: string;
  rate_per_hour: number;
  effective_date: string;
};

type RateMap = Record<string, RateRow>;

export default function RoomRates() {
  const [rates, setRates] = useState<RateMap | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/room-rates");
      if (!r.ok) throw new Error("Couldn't load room rates");
      const d = await r.json();
      const rateMap: RateMap = d.rates ?? {};
      setRates(rateMap);
      // Seed drafts from current rates
      const seeds: Record<string, string> = {};
      for (const room of ROOMS) {
        const row = rateMap[room.id];
        seeds[room.id] = row ? String(row.rate_per_hour) : "";
      }
      setDrafts(seeds);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (roomId: string) => {
    const val = drafts[roomId]?.trim();
    const rate = parseFloat(val ?? "");
    if (isNaN(rate) || rate < 0) {
      setMsgs((m) => ({ ...m, [roomId]: "Enter a valid rate (≥ 0)" }));
      return;
    }
    setSaving((s) => ({ ...s, [roomId]: true }));
    setMsgs((m) => ({ ...m, [roomId]: "" }));
    try {
      const r = await fetch("/api/admin/room-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, rate_per_hour: rate }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Couldn't save");
      setRates((prev) => ({ ...prev, [roomId]: d.rate }));
      setMsgs((m) => ({ ...m, [roomId]: "Saved" }));
    } catch (e) {
      setMsgs((m) => ({ ...m, [roomId]: e instanceof Error ? e.message : "Error" }));
    } finally {
      setSaving((s) => ({ ...s, [roomId]: false }));
    }
  };

  return (
    <section
      className="bx-glass rounded-xl p-5 space-y-4"
      aria-label="Room rates"
    >
      <div>
        <p className="text-xs font-semibold text-slate uppercase tracking-widest">
          Room rates
        </p>
        <p className="text-sm text-slate mt-1">
          Per-hour rate shown to bookers. Changes take effect immediately for new quotes.
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-red-400">{loadError}</p>
      ) : !rates ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROOMS.map((room) => {
            const current = rates[room.id];
            const draft = drafts[room.id] ?? "";
            const currentVal = current ? String(current.rate_per_hour) : "";
            const dirty = draft !== currentVal && draft !== "";
            const isSaving = saving[room.id] ?? false;
            const msg = msgs[room.id] ?? "";

            return (
              <div
                key={room.id}
                className="rounded-lg bx-well p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-parchment leading-tight">
                      {room.name}
                    </p>
                    {current && (
                      <p className="text-[11px] text-slate mt-0.5">
                        Effective {current.effective_date}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft}
                    placeholder={current ? String(current.rate_per_hour) : "—"}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [room.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && dirty) save(room.id);
                    }}
                    className="bx-input bx-input--sm flex-1 min-w-0"
                    aria-label={`${room.name} rate per hour`}
                  />
                  <span className="text-xs text-slate whitespace-nowrap">/hr</span>
                </div>

                <div className="flex items-center gap-2 min-h-[24px]">
                  <button
                    type="button"
                    disabled={!dirty || isSaving}
                    onClick={() => save(room.id)}
                    className="bx-btn bx-btn--primary bx-btn--sm"
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  {msg && (
                    <span
                      className={`text-xs ${
                        msg === "Saved" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {msg}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
