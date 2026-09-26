// /reservations/[id]/event-map — the reservation's Event Map.
// Server component: resolves access, loads the layer, mounts the editor.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient, buildEventLayer, getEventMapContext } from "@/lib/event-map";
import EventMapEditor from "./event-map-editor";

export const metadata = { title: "Event map · BX Reservations" };

const STATUS_LABEL: Record<string, string> = {
  pending_insurance: "Pending insurance",
  under_review: "In review",
  approved: "Approved",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
  rejected: "Not approved",
};

export default async function EventMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await getUserAndRole();
  if (!user) redirect("/login");
  const { id } = await params;

  const db = adminClient();
  const ctx = await getEventMapContext(db, { id: user.id, email: user.email }, id);
  if (!ctx) notFound();
  const layer = await buildEventLayer(db, ctx);
  const r = ctx.reservation;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 56px)", overflow: "hidden" }}>
      {/* slim header: back link · event · status · mode */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)",
          background: "var(--bx-ink)",
          flex: "none",
          minWidth: 0,
        }}
      >
        <Link
          href={`/reservations/${r.id}`}
          aria-label="Back to the reservation"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.875rem", color: "var(--bx-slate)", textDecoration: "none", flex: "none" }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Reservation
        </Link>
        <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "baseline", gap: "0.5rem", overflow: "hidden" }}>
          <span style={{ fontWeight: 700, color: "var(--bx-parchment)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.event_name}
          </span>
          {r.booking_number && <span style={{ fontSize: "0.75rem", color: "var(--bx-slate)", flex: "none" }}>{r.booking_number}</span>}
        </div>
        <span
          style={{
            flex: "none",
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: "999px",
            background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
            color: "var(--bx-slate)",
          }}
        >
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <EventMapEditor layer={layer} />
      </div>
    </div>
  );
}
