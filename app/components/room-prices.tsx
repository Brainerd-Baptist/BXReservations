"use client";

// Admin → Settings → Room prices (Owner / System Admin).
// One price list: the booking page estimate and each booking's charges use it.

import { useCallback, useEffect, useState } from "react";
import { ROOMS } from "@/lib/rooms";
import { BLOCK_HOURS, type PriceList } from "@/lib/pricing";
import { Button } from "./ui/button";
import { useToast } from "./Toast";
import LoadError from "./load-error";

type Draft = { np: string; std: string; extra: string };
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });

export default function RoomPrices() {
  const { toast } = useToast();
  const [prices, setPrices] = useState<PriceList | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seed = (p: PriceList) => {
    setPrices(p);
    setDrafts(Object.fromEntries(ROOMS.map((r) => [r.id, { np: String(p[r.id]?.np ?? ""), std: String(p[r.id]?.std ?? ""), extra: String(p[r.id]?.extra ?? "") }])));
  };

  const fetchPrices = async (): Promise<PriceList> => {
    const res = await fetch("/api/admin/room-prices");
    const d = await res.json();
    if (!res.ok) throw new Error(d?.error ?? "Couldn't load room prices");
    return d.prices;
  };
  const load = useCallback(async () => {
    setError(null);
    try { seed(await fetchPrices()); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => {
    let live = true;
    fetchPrices().then((p) => { if (live) seed(p); }).catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, []);

  async function save(roomId: string) {
    const d = drafts[roomId];
    setSaving(roomId);
    try {
      const res = await fetch("/api/admin/room-prices", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, np: Number(d.np), std: Number(d.std), extra: Number(d.extra) }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error ?? "Couldn't save");
      seed(out.prices);
      toast(`${ROOMS.find((r) => r.id === roomId)?.name ?? "Room"} prices saved.`, "success");
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(null); }
  }

  return (
    <section className="bx-glass rounded-xl p-5 space-y-4" aria-labelledby="room-prices-h">
      <div>
        <p id="room-prices-h" className="text-xs font-semibold text-slate uppercase tracking-widest">Room prices</p>
        <p className="text-sm text-slate mt-1">
          From the BX rate sheet: the price for {BLOCK_HOURS} hours, then a rate for each additional hour (billed by the half hour).
          The booking page and new bookings use these right away. Requests still waiting for review pick them up when their schedule changes; approved bookings keep their price unless staff press <strong>Recalculate room charges</strong>.
        </p>
      </div>

      {error ? <LoadError what="room prices" message={error} onRetry={load} /> : !prices ? (
        <p className="text-sm text-slate" aria-busy="true">Loading…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROOMS.map((room) => {
            const d = drafts[room.id] ?? { np: "", std: "", extra: "" };
            const cur = prices[room.id];
            const dirty = !!cur && (Number(d.np) !== cur.np || Number(d.std) !== cur.std || Number(d.extra) !== cur.extra);
            const valid = [d.np, d.std, d.extra].every((v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0);
            const std = Number(d.std) || 0;
            return (
              <form key={room.id} className="rounded-lg bx-well p-4 space-y-2.5"
                onSubmit={(e) => { e.preventDefault(); if (dirty && valid) save(room.id); }}>
                <p className="text-sm font-semibold text-parchment leading-tight">{room.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["std", "np", "extra"] as const).map((k) => (
                    <label key={k} className="block">
                      <span className="block text-[11px] text-slate mb-1">{k === "std" ? "Standard 4 hrs" : k === "np" ? "Non-profit 4 hrs" : "Each add'l hr"}</span>
                      <span className="flex items-center gap-1">
                        <span className="text-sm text-slate">$</span>
                        <input type="number" min="0" step="1" inputMode="decimal" value={d[k]}
                          onChange={(e) => setDrafts((all) => ({ ...all, [room.id]: { ...d, [k]: e.target.value } }))}
                          className="bx-input bx-input--sm w-full min-w-0" aria-label={`${room.name} ${k === "std" ? `standard price for ${BLOCK_HOURS} hours` : k === "np" ? `non-profit price for ${BLOCK_HOURS} hours` : "price for each additional hour"}`} />
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate">e.g. 6 hrs standard: {usd(std + 2 * (Number(d.extra) || 0))}</p>
                <Button type="submit" size="sm" disabled={!dirty || !valid} loading={saving === room.id}>Save</Button>
              </form>
            );
          })}
        </div>
      )}
    </section>
  );
}
