"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/Toast";

type Waived = { agreement: boolean; coi: boolean; payment: boolean };
const ITEMS: [keyof Waived, string][] = [["agreement", "Agreement"], ["coi", "Insurance"], ["payment", "Payment"]];

/** Admin booking panel: church use and which documents this booking needs (C4). */
export default function WaiverEditor({ reservationId, churchUse, waived, onSaved }: {
  reservationId: string; churchUse: boolean; waived: Waived; onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [cu, setCu] = useState(churchUse);
  const [w, setW] = useState<Waived>(waived);
  const [busy, setBusy] = useState(false);
  const dirty = cu !== churchUse || ITEMS.some(([k]) => w[k] !== waived[k]);

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/reservations/${reservationId}/waivers`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ church_use: cu, waived: w }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? `Error ${r.status}`);
      toast("Requirements updated.", "success");
      onSaved?.();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <fieldset className="bx-well rounded-xl p-3 space-y-2 text-xs">
      <legend className="sr-only">Requirements for this booking</legend>
      <label className="flex items-center gap-2 min-h-8">
        <input type="checkbox" checked={cu} onChange={(e) => setCu(e.target.checked)} />
        <span className="text-parchment font-medium">Church use</span>
        <span className="text-slate">(fast-tracked, any day)</span>
      </label>
      <p className="text-slate">Not needed for this booking:</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {ITEMS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-1.5 min-h-8">
            <input type="checkbox" checked={w[k]} onChange={(e) => setW({ ...w, [k]: e.target.checked })} />
            <span className="text-parchment">{label}</span>
          </label>
        ))}
      </div>
      {dirty && <Button size="sm" onClick={save} loading={busy}>Save requirements</Button>}
    </fieldset>
  );
}
