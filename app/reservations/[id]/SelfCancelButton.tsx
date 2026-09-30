"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props { reservationId: string }

export default function SelfCancelButton({ reservationId }: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [reason, setReason]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleCancel() {
    if (!reason.trim()) { setError("Please provide a reason."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: "0.8125rem",
          color: "var(--bx-slate)",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        }}
      >
        Cancel this request
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: "0.5rem",
        padding: "0.875rem 1rem",
        borderRadius: "8px",
        border: "1px solid color-mix(in srgb, var(--bx-clay) 30%, transparent)",
        background: "color-mix(in srgb, var(--bx-clay) 6%, transparent)",
      }}
    >
      <p style={{ margin: "0 0 0.625rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--bx-parchment)" }}>
        Cancel this request?
      </p>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--bx-slate)" }}>
        This can&#8217;t be undone. A reason is required &#8212; everyone on this booking and the BX team will see who cancelled, when, and why.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Reason for cancelling (required)"
        placeholder="Reason for cancelling (required)"
        rows={3}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "0.5rem 0.625rem",
          borderRadius: "6px",
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 18%, transparent)",
          background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)",
          color: "var(--bx-parchment)",
          fontSize: "0.875rem",
          resize: "vertical",
          marginBottom: "0.625rem",
          fontFamily: "inherit",
        }}
      />
      {error && (
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "var(--bx-clay)" }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: "0.625rem" }}>
        <button
          onClick={handleCancel}
          disabled={loading}
          style={{
            padding: "0.4375rem 0.875rem",
            borderRadius: "6px",
            border: "none",
            background: "var(--bx-clay)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button
          onClick={() => { setOpen(false); setReason(""); setError(null); }}
          disabled={loading}
          style={{
            padding: "0.4375rem 0.875rem",
            borderRadius: "6px",
            border: "1px solid color-mix(in srgb, var(--bx-parchment) 18%, transparent)",
            background: "none",
            color: "var(--bx-parchment)",
            fontWeight: 500,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
