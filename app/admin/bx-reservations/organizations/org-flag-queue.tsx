"use client";

import { useState, useTransition } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OrgFlag {
  id: string;
  created_at: string;
  raw_text: string;
  flag_type: "new_org" | "fuzzy_match" | "duplicate" | "user_mismatch" | "name_typo";
  confidence: number | null;
  candidates: { id: string; name: string; confidence: number }[] | null;
  resolved_at: string | null;
  resolution: string | null;
  reservation_id: string | null;
  reservations: {
    id: string;
    booking_number: string;
    contact_name: string;
    event_name: string;
    status: string;
  } | null;
  suggested_org_id: string | null;
  bx_organizations: {
    id: string;
    name: string;
    tier: string;
    status: string;
  } | null;
}

// ─── Flag type labels ─────────────────────────────────────────────────────────
const FLAG_LABELS: Record<OrgFlag["flag_type"], { label: string; color: string }> = {
  new_org:        { label: "New Org Created",  color: "#2563eb" },
  fuzzy_match:    { label: "Fuzzy Match",       color: "#d97706" },
  duplicate:      { label: "Possible Duplicate",color: "#dc2626" },
  user_mismatch:  { label: "User Mismatch",     color: "#7c3aed" },
  name_typo:      { label: "Name Typo",         color: "#0891b2" },
};

// ─── Single flag row ──────────────────────────────────────────────────────────
function FlagRow({
  flag,
  onResolved,
}: {
  flag: OrgFlag;
  onResolved: (id: string, resolution: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosenOrgId, setChosenOrgId] = useState<string | null>(
    flag.suggested_org_id
  );

  const flagInfo = FLAG_LABELS[flag.flag_type];
  const pct = flag.confidence != null ? Math.round(flag.confidence * 100) : null;

  async function resolve(resolution: "approved" | "merged" | "corrected" | "dismissed") {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/org-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flag_id: flag.id,
          resolution,
          organization_id: resolution === "dismissed" ? null : chosenOrgId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to resolve flag");
      } else {
        onResolved(flag.id, resolution);
      }
    });
  }

  return (
    <div
      style={{
        border: "1px solid var(--bx-border, #e5e7eb)",
        borderRadius: 10,
        padding: "16px 18px",
        marginBottom: 12,
        background: "var(--bx-surface, #fff)",
        opacity: isPending ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: flagInfo.color,
            background: flagInfo.color + "18",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {flagInfo.label}
        </span>
        {pct != null && (
          <span style={{ fontSize: 12, color: "var(--bx-muted, #6b7280)" }}>
            {pct}% confidence
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--bx-muted, #6b7280)", marginLeft: "auto" }}>
          {new Date(flag.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </span>
      </div>

      {/* What the user typed */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "var(--bx-muted, #6b7280)" }}>Typed: </span>
        <strong style={{ fontSize: 14 }}>{flag.raw_text}</strong>
      </div>

      {/* Linked reservation */}
      {flag.reservations && (
        <div
          style={{
            fontSize: 12,
            color: "var(--bx-muted, #6b7280)",
            marginBottom: 10,
          }}
        >
          Reservation{" "}
          <a
            href={`/admin/bx-reservations/${flag.reservations.id}`}
            style={{ color: "var(--bx-accent, #2563eb)", textDecoration: "none" }}
          >
            #{flag.reservations.booking_number}
          </a>{" "}
          — {flag.reservations.contact_name} / {flag.reservations.event_name}
        </div>
      )}

      {/* Suggested org / candidate chooser */}
      {flag.bx_organizations && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--bx-muted, #6b7280)" }}>
            Suggested org:{" "}
          </span>
          <strong style={{ fontSize: 13 }}>{flag.bx_organizations.name}</strong>
          <span
            style={{
              fontSize: 11,
              marginLeft: 6,
              color: "var(--bx-muted, #6b7280)",
              textTransform: "uppercase",
            }}
          >
            {flag.bx_organizations.tier}
            {flag.bx_organizations.status !== "confirmed" &&
              ` · ${flag.bx_organizations.status}`}
          </span>
        </div>
      )}

      {/* Candidates for duplicate flags */}
      {flag.candidates && flag.candidates.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "var(--bx-muted, #6b7280)", marginBottom: 4 }}>
            Possible matches — choose one to link:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {flag.candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => setChosenOrgId(c.id)}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1.5px solid ${chosenOrgId === c.id ? "var(--bx-accent, #2563eb)" : "var(--bx-border, #e5e7eb)"}`,
                  background: chosenOrgId === c.id ? "var(--bx-accent-light, #eff6ff)" : "transparent",
                  cursor: "pointer",
                  fontWeight: chosenOrgId === c.id ? 600 : 400,
                }}
              >
                {c.name}{" "}
                <span style={{ color: "var(--bx-muted, #6b7280)" }}>
                  ({Math.round(c.confidence * 100)}%)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{error}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {flag.flag_type !== "new_org" && (
          <button
            onClick={() => resolve("approved")}
            disabled={isPending}
            style={btnStyle("var(--bx-accent, #2563eb)")}
          >
            ✓ Approve link
          </button>
        )}
        {flag.flag_type === "new_org" && (
          <button
            onClick={() => resolve("approved")}
            disabled={isPending}
            style={btnStyle("var(--bx-sage, #059669)")}
          >
            ✓ Confirm new org
          </button>
        )}
        {flag.candidates && flag.candidates.length > 0 && chosenOrgId && (
          <button
            onClick={() => resolve("merged")}
            disabled={isPending}
            style={btnStyle("#7c3aed")}
          >
            Merge into selected
          </button>
        )}
        <button
          onClick={() => resolve("corrected")}
          disabled={isPending}
          style={btnStyle("#d97706")}
        >
          Corrected
        </button>
        <button
          onClick={() => resolve("dismissed")}
          disabled={isPending}
          style={btnStyle("#6b7280")}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 6,
    border: `1.5px solid ${color}`,
    background: "transparent",
    color,
    cursor: "pointer",
  };
}

// ─── Flag Queue Panel ─────────────────────────────────────────────────────────
export default function OrgFlagQueue({
  initialFlags,
}: {
  initialFlags: OrgFlag[];
}) {
  const [flags, setFlags] = useState<OrgFlag[]>(initialFlags);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visible = showResolved ? flags : flags.filter((f) => !f.resolved_at);
  const unresolvedCount = flags.filter((f) => !f.resolved_at).length;

  function handleResolved(id: string, resolution: string) {
    setFlags((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, resolved_at: new Date().toISOString(), resolution }
          : f
      )
    );
  }

  async function runBackfill() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/org-flags?backfill=1", { method: "POST" });
      const j = await res.json();
      setBackfillResult(`Backfill done — ${j.backfill?.processed ?? 0} reservation(s) processed.`);
      // Reload flags after backfill
      startTransition(async () => {
        const fr = await fetch("/api/admin/org-flags");
        const fj = await fr.json();
        if (fj.flags) setFlags(fj.flags);
      });
    } catch {
      setBackfillResult("Backfill failed — check console.");
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          Org Flag Queue
          {unresolvedCount > 0 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                fontWeight: 700,
                background: "#dc2626",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 7px",
              }}
            >
              {unresolvedCount}
            </span>
          )}
        </h2>

        <button
          onClick={() => setShowResolved((v) => !v)}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--bx-border, #e5e7eb)",
            background: "transparent",
            cursor: "pointer",
            color: "var(--bx-muted, #6b7280)",
          }}
        >
          {showResolved ? "Hide resolved" : "Show resolved"}
        </button>

        <button
          onClick={runBackfill}
          disabled={backfilling || isPending}
          style={{
            fontSize: 12,
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid var(--bx-accent, #2563eb)",
            background: "transparent",
            color: "var(--bx-accent, #2563eb)",
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          {backfilling ? "Running…" : "Backfill unlinked reservations"}
        </button>
      </div>

      {backfillResult && (
        <div
          style={{
            fontSize: 13,
            color: "var(--bx-muted, #6b7280)",
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--bx-surface, #f9fafb)",
            borderRadius: 6,
            border: "1px solid var(--bx-border, #e5e7eb)",
          }}
        >
          {backfillResult}
        </div>
      )}

      {visible.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--bx-muted, #6b7280)" }}>
          {unresolvedCount === 0
            ? "No unresolved flags. All orgs are linked."
            : "Nothing to show."}
        </p>
      ) : (
        visible.map((flag) => (
          <FlagRow key={flag.id} flag={flag} onResolved={handleResolved} />
        ))
      )}
    </section>
  );
}
