"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  reservationId: string;
  agreementId:   string;
  token:         string;
  contactName:   string;
}

export default function AgreementSignForm({ reservationId, token, contactName }: Props) {
  const router   = useRouter();
  const [name,   setName]    = useState("");
  const [agreed, setAgreed]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,  setError]   = useState<string | null>(null);
  const [done,   setDone]    = useState(false);

  const nameMatch = name.trim().toLowerCase() === contactName.trim().toLowerCase();
  const canSubmit = name.trim().length >= 2 && agreed && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/agreement/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, typed_name: name.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      setDone(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ background: "var(--tone-green-bg)", border: "1px solid var(--tone-green-bd)", borderRadius: 10, padding: "1.5rem", color: "var(--tone-green-fg)", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>Agreement Signed</h2>
        <p style={{ margin: 0, fontSize: "0.9rem" }}>Thank you, {name}. Your signature has been recorded and the BX team has been notified. You can close this window.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--bx-parchment)" }}>
          Type your full legal name to sign
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={contactName}
          required
          style={{
            width: "100%", padding: "0.75rem 1rem", fontSize: "1rem",
            background: "color-mix(in srgb, var(--bx-parchment) 5%, transparent)",
            border: `1px solid ${nameMatch && name.trim() ? "var(--tone-green-bd)" : "color-mix(in srgb, var(--bx-parchment) 20%, transparent)"}`,
            borderRadius: 8, color: "var(--bx-parchment)", outline: "none", boxSizing: "border-box",
          }}
        />
        {name.trim() && !nameMatch && (
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "var(--tone-orange-fg)" }}>
            Name must match exactly: <em>{contactName}</em>
          </p>
        )}
        {nameMatch && name.trim() && (
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "var(--tone-green-fg)" }}>✓ Name matches</p>
        )}
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer", fontSize: "0.875rem", color: "var(--bx-slate)", lineHeight: 1.55 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: "0.15rem", accentColor: "var(--bx-brass)", flex: "none" }}
          />
          I have read and understand the Facility Use Agreement above, and I agree to all terms on behalf of myself and my organization. I understand this electronic signature is legally binding.
        </label>
      </div>

      {error && (
        <div style={{ background: "var(--tone-red-bg)", border: "1px solid var(--tone-red-bd)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", color: "var(--tone-red-fg)", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          background: canSubmit ? "var(--bx-action-bg)" : "color-mix(in srgb, var(--bx-parchment) 10%, transparent)",
          color: canSubmit ? "var(--bx-action-fg)" : "var(--bx-slate)",
          border: "none", borderRadius: 8, padding: "0.875rem 2rem",
          fontSize: "0.9375rem", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Signing…" : "Sign Agreement"}
      </button>
      <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "var(--bx-slate)" }}>
        Your IP address and timestamp will be recorded alongside your typed name.
      </p>
    </form>
  );
}
