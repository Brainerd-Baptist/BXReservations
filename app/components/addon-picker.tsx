"use client";

import { UNIT_LABEL, usd } from "@/lib/billing";
import { addonApplies, addonTotal, isTiered, tierSummary, type AddonWithRules } from "@/lib/addon-pricing";
import type { PricedDay } from "@/lib/pricing";
import { useAddonCatalog, useNoCharge } from "@/lib/room-price-context";

export type AddonSelection = Record<string, number>;
type Day = PricedDay & { date?: string; included?: boolean; rooms?: { roomId: string }[] };

/** Add-ons that fit the chosen rooms, with their estimated cost. */
export function addonsSubtotal(catalog: AddonWithRules[], value: AddonSelection, days: Day[], free = false): number {
  return catalog.reduce((s, a) => s + addonTotal(a, value[a.id] ?? 0, days, free), 0);
}

/** Only selections that still fit the booking's rooms (sent with the request). */
export function applicableSelection(catalog: AddonWithRules[], value: AddonSelection, days: Day[]): AddonSelection {
  return Object.fromEntries(Object.entries(value).filter(([id, q]) => {
    const a = catalog.find((c) => c.id === id);
    return a && q > 0 && addonApplies(a, days);
  }));
}

/**
 * Optional add-ons on the booking form, from the BX rental services sheet.
 * Room-only items (UHF mic, Complete AV package, AV setup) appear once a
 * matching room is chosen. Renders nothing when the catalog is empty.
 */
export default function AddonPicker({ value, onChange, days }: {
  value: AddonSelection;
  onChange: (v: AddonSelection) => void;
  days: Day[];
}) {
  const catalog = useAddonCatalog() ?? [];
  const free = useNoCharge();
  const shown = catalog.filter((a) => addonApplies(a, days));
  if (!shown.length) return null;

  const dayCount = days.filter((d) => d.included !== false).length;
  const set = (id: string, q: number) => {
    const next = { ...value };
    if (q > 0) next[id] = q; else delete next[id];
    onChange(next);
  };
  const subtotal = addonsSubtotal(shown, value, days, free);

  return (
    <fieldset className="mb-6">
      <legend className="text-sm font-semibold text-parchment mb-1">Add-ons <span className="font-normal text-slate">(optional)</span></legend>
      <p className="text-xs text-slate mb-3">
        Rooms already include table and chair set-up, tear-down and trash removal. Bringing a presentation? Bring your own laptop.
      </p>
      <ul className="space-y-2">
        {shown.map((a) => {
          const q = value[a.id] ?? 0;
          const tiered = isTiered(a);
          const checkbox = a.unit === "flat" || tiered;
          const est = q > 0 ? addonTotal(a, q, days, free) : 0;
          return (
            <li key={a.id} className="bx-well rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-parchment">{a.name}</p>
                <p className="text-xs text-slate">
                  {free ? "No charge" : tiered ? tierSummary(a.pricing!) : `${usd(Number(a.price))} ${a.unit === "flat" ? "per event" : UNIT_LABEL[a.unit]}`}
                  {a.description ? ` · ${a.description}` : ""}
                </p>
                {tiered && q > 0 && !free && (
                  <p className="text-xs text-parchment mt-0.5">For your hours: <strong className="tabular">{usd(est)}</strong></p>
                )}
              </div>
              {checkbox ? (
                <label className="flex items-center gap-2 text-sm text-parchment shrink-0">
                  <input type="checkbox" checked={q > 0} onChange={(e) => set(a.id, e.target.checked ? 1 : 0)} className="w-5 h-5" />
                  Add
                </label>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label={`${a.name} quantity`}>
                  <button type="button" className="bx-btn bx-btn--secondary bx-btn--sm" aria-label={`Fewer ${a.name}`} disabled={q === 0} onClick={() => set(a.id, q - 1)}>−</button>
                  <span className="w-8 text-center tabular text-parchment" aria-live="polite">{q}</span>
                  <button type="button" className="bx-btn bx-btn--secondary bx-btn--sm" aria-label={`More ${a.name}`} onClick={() => set(a.id, q + (q === 0 && a.unit === "per_day" ? Math.max(1, dayCount) : 1))}>+</button>
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
