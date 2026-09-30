"use client";

// Door-sign options the planner controls: today, whether each sign carries the QR to the event map.

import { useState } from "react";

export default function SignOptions({ reservationId, initialQr, canEdit }: { reservationId: string; initialQr: boolean; canEdit: boolean }) {
  const [qr, setQr] = useState(initialQr);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (next: boolean) => {
    setBusy(true); setError(null);
    const prev = qr; setQr(next);
    try {
      const r = await fetch(`/api/event-map/${reservationId}/signs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qr: next }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Couldn't save");
    } catch (e) {
      setQr(prev); setError(e instanceof Error ? e.message : "Couldn't save");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--bx-slate)" }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: canEdit ? "pointer" : "default" }}>
        <input type="checkbox" checked={qr} disabled={!canEdit || busy} onChange={(e) => toggle(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--bx-brass)" }} />
        <span>Include a QR code on each sign <span style={{ opacity: 0.8 }}>(opens the shared event map on that room)</span></span>
      </label>
      {error && <p role="alert" style={{ margin: "0.25rem 0 0", color: "var(--bx-clay)" }}>{error}</p>}
    </div>
  );
}
