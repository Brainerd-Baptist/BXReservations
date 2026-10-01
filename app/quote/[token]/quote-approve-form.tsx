"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";

/** Type your name + check the box = your electronic signature. */
export default function QuoteApproveForm({ token, contactName, total, includesAgreement }: {
  token: string; contactName: string; total: string; includesAgreement: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState(false);
  const [reason, setReason] = useState("");
  const ready = name.trim().length >= 2 && agree;

  async function requestChanges(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) { setError("Tell us what you'd like changed (a sentence or two)."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/quote/${token}/decline`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Couldn't send — try again.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (changes) {
    return (
      <form onSubmit={requestChanges} className="bx-glass rounded-2xl p-5 space-y-4" aria-labelledby="q-changes">
        <h2 id="q-changes" className="text-lg font-bold text-parchment">Request changes</h2>
        <p className="text-sm text-slate">
          Tell the BX team what isn&apos;t right — a room, the times, an add-on, the price — or that you&apos;re not moving forward.
          They&apos;ll send an updated quote. Your note goes into your booking&apos;s messages.
        </p>
        <div>
          <label htmlFor="q-reason" className="block text-sm font-semibold text-parchment mb-1">What would you like changed? <span aria-hidden="true" style={{ color: "var(--bx-clay)" }}>*</span></label>
          <textarea id="q-reason" className="bx-input w-full" rows={4} maxLength={2000} required value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder="e.g. We only need the Crossing until 8pm, and can we drop the AV package?" />
        </div>
        {error && <p className="bx-tone-red border rounded-lg px-3 py-2 text-sm" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy} disabled={reason.trim().length < 10}>Send request</Button>
          <Button type="button" variant="ghost" onClick={() => { setChanges(false); setError(null); }}>Back to the quote</Button>
        </div>
        <p className="text-xs text-slate">Not holding the booking at all? You can cancel it from your booking page.</p>
      </form>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/quote/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), agree }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Couldn't approve — try again.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bx-glass rounded-2xl p-5 space-y-4" aria-labelledby="q-approve">
      <h2 id="q-approve" className="text-lg font-bold text-parchment">Approve {includesAgreement ? "and sign" : "your quote"}</h2>
      <div>
        <label htmlFor="q-name" className="block text-sm font-semibold text-parchment mb-1">Type your full name</label>
        <input id="q-name" className="bx-input w-full" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={contactName || "Full name"} maxLength={120} required />
        <p className="text-xs text-slate mt-1">Typing your name here is your electronic signature.</p>
      </div>
      <label className="flex items-start gap-3 text-sm text-parchment">
        <input type="checkbox" className="w-5 h-5 mt-0.5 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          I approve this quote for <strong>{total}</strong>
          {includesAgreement ? <> and agree to the Facility Use Agreement above</> : null}
          {" "}on behalf of the organizer of this event.
        </span>
      </label>
      {error && <p className="bx-tone-red border rounded-lg px-3 py-2 text-sm" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!ready} loading={busy}>Approve{includesAgreement ? " & sign" : " quote"}</Button>
        <Button type="button" variant="secondary" onClick={() => { setChanges(true); setError(null); }}>Request changes</Button>
      </div>
    </form>
  );
}
