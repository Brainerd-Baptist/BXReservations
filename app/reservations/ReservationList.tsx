"use client";

import Link from "next/link";
import { RESERVATION_STATUS, BADGE_FALLBACK } from "@/lib/status-tokens";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Reservation {
  id: string;
  booking_number?: string | null;
  created_at: string;
  status: string;
  event_name?: string | null;
  payload?: unknown;
}

export interface Collab {
  id: string;
  collab_role: string;
  reservations: {
    id: string;
    event_name?: string;
    payload?: unknown;
    status?: string;
  } | null;
}

interface Props {
  upcoming: Reservation[];
  sharedCollabs: Collab[] | null;
  past: Reservation[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROOM_LABELS: Record<string, string> = {
  "crosspointe-a": "Crosspointe A",
  "crosspointe-b": "Crosspointe B",
  "crosspointe-c": "Crosspointe C",
  "crosstiesA": "CrossTies A",
  "crosstiesB": "CrossTies B",
  "crosstiesC": "CrossTies C",
  "crosstiescafe": "CrossTies Café",
  "crossing": "The Crossing",
  "crossview": "CrossView",
  "loft": "The Loft",
};

function parsePayload(payload: unknown) {
  const p = payload as {
    days?: Array<{ date?: string; rooms?: Array<{ roomId?: string }> }>;
    contact?: { eventName?: string };
  } | null;
  const firstDay = p?.days?.[0];
  const startDate = firstDay?.date ?? null;
  const roomId = firstDay?.rooms?.[0]?.roomId ?? null;
  const space = roomId ? (ROOM_LABELS[roomId] ?? roomId) : null;
  return { startDate, space };
}

function formatDate(dateStr?: string | null, fallback?: string | null) {
  const d = dateStr || fallback;
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusChip(status: string) {
  const s = RESERVATION_STATUS[status] ?? { ...BADGE_FALLBACK, label: status };
  return (
    <span
      className="bx-badge"
      style={{
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.03em",
        background: s.bg,
        color: s.color,
        border: s.border ? `1px solid ${s.border}` : undefined,
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

function sectionHeader(label: string, count?: number) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
      <h2
        style={{
          margin: 0,
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--bx-slate)",
        }}
      >
        {label}
      </h2>
      {count !== undefined && count > 0 && (
        <span
          style={{
            padding: "1px 7px",
            borderRadius: "9999px",
            fontSize: "0.7rem",
            fontWeight: 600,
            background: "color-mix(in srgb, var(--bx-slate) 15%, transparent)",
            color: "var(--bx-slate)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

const chevron = (size: number) => (
  <svg
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    style={{ color: "var(--bx-slate)", flexShrink: 0 }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

function hoverOn(e: React.MouseEvent<HTMLAnchorElement>) {
  (e.currentTarget as HTMLAnchorElement).style.background =
    "color-mix(in srgb, var(--bx-parchment) 3%, transparent)";
}
function hoverOff(e: React.MouseEvent<HTMLAnchorElement>) {
  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
}

const rowBase: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  textDecoration: "none",
  transition: "background 0.1s",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ReservationList({ upcoming, sharedCollabs, past }: Props) {
  return (
    <>
      {/* ── Upcoming ── */}
      <div className="bx-fade-in" style={{ marginBottom: "1.5rem" }}>
        {sectionHeader("Upcoming", upcoming.length)}
        <div
          style={{
            border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
            borderRadius: "12px",
            overflow: "hidden",
            background: "var(--bx-ink-soft)",
          }}
        >
          {upcoming.length === 0 ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "var(--bx-slate)" }}>
              <p style={{ margin: "0 0 0.5rem" }}>No upcoming reservations.</p>
              <Link href="/reserve" style={{ color: "var(--bx-brass)", fontWeight: 600, textDecoration: "none" }}>
                Make a request →
              </Link>
            </div>
          ) : (
            upcoming.map((r, i) => {
              const { startDate, space } = parsePayload(r.payload);
              return (
                <Link
                  key={r.id}
                  href={`/reservations/${r.id}`}
                  style={{
                    ...rowBase,
                    padding: "0.875rem 1.25rem",
                    borderTop:
                      i === 0
                        ? "none"
                        : "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                  }}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--bx-parchment)" }}>
                      {r.event_name || space || "Reservation"}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.15rem" }}>
                      {formatDate(startDate, r.created_at)}
                      {r.booking_number ? ` · ${r.booking_number}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {statusChip(r.status)}
                    {chevron(16)}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── Shared with me ── */}
      {sharedCollabs && sharedCollabs.length > 0 && (
        <div className="bx-fade-in" style={{ marginBottom: "1.5rem" }}>
          {sectionHeader("Shared with me", sharedCollabs.length)}
          <div
            style={{
              border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
              borderRadius: "12px",
              overflow: "hidden",
              background: "var(--bx-ink-soft)",
            }}
          >
            {sharedCollabs.map((collab, i) => {
              const res = collab.reservations;
              const { startDate: resStart, space: resSpace } = parsePayload(res?.payload);
              const label = res?.event_name || resSpace || "Shared reservation";
              const dateStr = formatDate(resStart);
              const roleLabel = collab.collab_role === "co_owner" ? "Co-owner" : "Viewer";
              return (
                <Link
                  key={collab.id}
                  href={res?.id ? `/reservations/${res.id}` : "#"}
                  style={{
                    ...rowBase,
                    padding: "0.875rem 1.25rem",
                    borderTop:
                      i === 0
                        ? "none"
                        : "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                  }}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--bx-parchment)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.15rem" }}>
                      {dateStr ? dateStr + " · " : ""}
                      {roleLabel}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {res?.status && statusChip(res.status)}
                    {chevron(16)}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Past ── */}
      {past.length > 0 && (
        <div className="bx-fade-in" style={{ marginBottom: "1.5rem" }}>
          {sectionHeader("Past", past.length)}
          <div
            style={{
              border: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
              borderRadius: "12px",
              overflow: "hidden",
              background: "var(--bx-ink-soft)",
              opacity: 0.75,
            }}
          >
            {past.map((r, i) => {
              const { startDate, space } = parsePayload(r.payload);
              return (
                <Link
                  key={r.id}
                  href={`/reservations/${r.id}`}
                  style={{
                    ...rowBase,
                    padding: "0.75rem 1.25rem",
                    borderTop:
                      i === 0
                        ? "none"
                        : "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                  }}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--bx-parchment)" }}>
                      {r.event_name || space || "Reservation"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--bx-slate)", marginTop: "0.1rem" }}>
                      {formatDate(startDate, r.created_at)}
                      {r.booking_number ? ` · ${r.booking_number}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {statusChip(r.status)}
                    {chevron(14)}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
