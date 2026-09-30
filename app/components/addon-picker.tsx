"use client";

import { useEffect, useState } from "react";
import { UNIT_LABEL, usd, type Addon } from "@/lib/billing";

export type AddonSelection = Record<string, number>;

/**
 * Optional add-ons on the booking form (tablecloths, supplies, services).
 * Renders nothing when the catalog is empty or can't load — booking still works.
 */
export default function AddonPicker({ value, onChange, days }: {
  value: AddonSelection;
  onChange: (v: AddonSelection) => void;
  days: number;
}) {
  const [catalog, setCatalog] = useState<Addon[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/addons").then((r) => (r.ok ? r.json() : [])).then((d) => { if (live && Array.isArray(d)) setCatalog(d); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!catalog.length) return null;

  const set = (id: string, q: number) => {
    const next = { ...value };
    if (q > 0) next[id] = q; else delete next[id];
    onChange(next);
  };
  const subtotal = catalog.reduce((s, a) => s + (value[a.id] ?? 0) * Number(a.price), 0);

  return (
    <fieldset className="mb-6">
      <legend className="text-sm font-semibold text-parchment mb-1">Add-ons <span className="font-normal text-slate">(optional)</span></legend>
      <p className="text-xs text-slate mb-3">Anything you add is confirmed by our events team with your final total.</p>
      <ul className="space-y-2">
        {catalog.map((a) => {
          const q = value[a.id] ?? 0;
          const flat = a.unit === "flat";
          return (
            <li key={a.id} className="bx-well rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-parchment">{a.name}</p>
                <p className="text-xs text-slate">{usd(Number(a.price))} {UNIT_LABEL[a.unit]}{a.description ? ` · ${a.description}` : ""}</p>
              </div>
              {flat ? (
                <label className="flex items-center gap-2 text-sm text-parchment shrink-0">
                  <input type="checkbox" checked={q > 0} onChange={(e) => set(a.id, e.target.checked ? 1 : 0)} className="w-5 h-5" />
                  Add
                </label>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label={`${a.name} quantity`}>
                  <button type="button" className="bx-btn bx-btn--secondary bx-btn--sm" aria-label={`Fewer ${a.name}`} disabled={q === 0} onClick={() => set(a.id, q - 1)}>−</button>
                  <span className="w-8 text-center tabular text-parchment" aria-live="polite">{q}</span>
                  <button type="button" className="bx-btn bx-btn--secondary bx-btn--sm" aria-label={`More ${a.name}`} onClick={() => set(a.id, q + (q === 0 && a.unit === "per_day" ? Math.max(1, days) : 1))}>+</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {subtotal > 0 && <p className="text-sm text-parchment mt-2 text-right">Add-ons: <strong className="tabular">{usd(subtotal)}</strong></p>}
    </fieldset>
  );
}
