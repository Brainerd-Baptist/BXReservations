"use client";

// Admin → Settings → Add-on catalog (tablecloths, supplies, services).
// Owners and System Admins edit; hiding an item keeps it on past bookings.

import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { useToast } from "./Toast";
import LoadError from "./load-error";
import { UNIT_LABEL, usd, type Addon } from "@/lib/billing";

type Draft = { name: string; description: string; unit: Addon["unit"]; price: string };
const EMPTY: Draft = { name: "", description: "", unit: "each", price: "" };

export default function AddonCatalog() {
  const { toast } = useToast();
  const [items, setItems] = useState<Addon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/addons");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't load add-ons");
      setItems(d);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/addons").then(async (r) => {
      const d = await r.json();
      if (!live) return;
      if (!r.ok) setError(d.error ?? "Couldn't load add-ons"); else setItems(d);
    }).catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, []);

  function start(a?: Addon) {
    setEditing(a ? a.id : "new");
    setDraft(a ? { name: a.name, description: a.description ?? "", unit: a.unit, price: String(a.price) } : EMPTY);
  }

  async function save(body: Record<string, unknown>, method: "POST" | "PATCH", ok: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/addons", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Couldn't save");
      toast(ok, "success");
      setEditing(null);
      await load();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: draft.name, description: draft.description, unit: draft.unit, price: Number(draft.price) };
    if (editing === "new") save(body, "POST", "Add-on added.");
    else save({ id: editing, ...body }, "PATCH", "Add-on updated.");
  };

  return (
    <div className="rounded-2xl bx-glass p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-parchment">Add-ons</p>
          <p className="text-sm text-slate mt-1">Tablecloths, supplies and services people can add to a booking. Prices show on the booking form.</p>
        </div>
        {editing === null && <Button size="sm" onClick={() => start()}>+ New add-on</Button>}
      </div>

      {error ? <LoadError what="add-ons" message={error} onRetry={load} />
        : !items ? <p className="text-sm text-slate">Loading…</p>
        : (
          <div className="space-y-2">
            {editing !== null && (
              <form onSubmit={submit} className="bx-well rounded-xl p-4 grid gap-3 sm:grid-cols-2">
                <Field label="Name" required>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={120} placeholder="e.g. White tablecloth (8 ft)" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price ($)" required>
                    <Input type="number" min="0" step="0.01" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} required />
                  </Field>
                  <Field label="Priced">
                    <Select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Addon["unit"] })}>
                      <option value="each">Each</option>
                      <option value="per_day">Per day</option>
                      <option value="flat">Flat fee</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Description (optional)" className="sm:col-span-2">
                  <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} placeholder="What's included, sizes, lead time" />
                </Field>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" size="sm" loading={busy}>Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </form>
            )}
            {items.length === 0 && editing === null && <p className="text-sm text-slate">No add-ons yet.</p>}
            {items.map((a) => (
              <div key={a.id} className="bx-well rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2" style={{ opacity: a.active ? 1 : 0.6 }}>
                <div className="min-w-0">
                  <p className="font-medium text-parchment">{a.name} {!a.active && <span className="text-xs text-slate">(hidden)</span>}</p>
                  <p className="text-xs text-slate">{usd(Number(a.price))} {UNIT_LABEL[a.unit]}{a.description ? ` · ${a.description}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => start(a)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => save({ id: a.id, active: !a.active }, "PATCH", a.active ? "Hidden from the booking form." : "Shown on the booking form.")}>
                    {a.active ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
