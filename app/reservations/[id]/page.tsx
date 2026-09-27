import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient, isStaffRole } from "@/lib/event-map";
import { ROOMS } from "@/lib/rooms";
import { logoState, readLogoRow } from "@/lib/event-logo";
import type { LogoState } from "@/lib/event-logo-types";
import EventLogoCard from "@/app/components/event-logo-card";
import { signsUnlocked } from "@/lib/signs/gate";
import SelfCancelButton from "./SelfCancelButton";
import CommentsThread from "@/components/bx/CommentsThread";
import COIUploadCard from "./COIUploadCard";

const STATUS_META: Record<string, { dot: string }> = {
  pending:            { dot: "#FBBF24" },
  under_review:       { dot: "#818CF8" },
  needs_info:         { dot: "#F59E0B" },
  pending_documents:  { dot: "#F59E0B" },
  pending_payment:    { dot: "#F59E0B" },
  approved:           { dot: "#34D399" },
  confirmed:          { dot: "#34D399" },
  completed:          { dot: "#9CA3AF" },
  rejected:           { dot: "#F87171" },
  cancelled:          { dot: "#9CA3AF" },
  cancelled_by_admin: { dot: "#F87171" },
  cancelled_by_user:  { dot: "#9CA3AF" },
  auto_cancelled:     { dot: "#9CA3AF" },
};

const STATUS_EXPLANATION: Record<string, { headline: string; detail?: string }> = {
  pending:            { headline: "Awaiting Review",           detail: "Your reservation request has been received and is waiting for staff review." },
  under_review:       { headline: "Under Review",              detail: "Staff is reviewing your request and will notify you of any updates." },
  needs_info:         { headline: "More Information Needed",   detail: "Staff needs additional information from you before this reservation can move forward. Please reply to the message in the thread below." },
  pending_documents:  { headline: "Documents Required",        detail: "Your reservation requires additional documents before it can be confirmed. Please upload the requested items below." },
  pending_payment:    { headline: "Payment Required",          detail: "A payment is required to confirm your reservation. Please follow the instructions from staff." },
  approved:           { headline: "Approved",                  detail: "Your reservation has been approved." },
  confirmed:          { headline: "Confirmed",                 detail: "Your reservation is confirmed — see you there!" },
  completed:          { headline: "Completed",                 detail: "This reservation has concluded. Thank you for using BX Reservations." },
  rejected:           { headline: "Not Approved",              detail: "This reservation was not approved. Please contact us if you have questions." },
  cancelled:          { headline: "Cancelled",                 detail: "This reservation has been cancelled." },
  cancelled_by_admin: { headline: "Cancelled by Staff",        detail: "Staff has cancelled this reservation. Please contact us if you have questions." },
  cancelled_by_user:  { headline: "Cancelled",                 detail: "You cancelled this reservation. Submit a new request if you'd like to rebook." },
  auto_cancelled:     { headline: "Automatically Cancelled",   detail: "This reservation was automatically cancelled due to inactivity. Submit a new request if you'd still like to book." },
};

const SELF_CANCEL_STATUSES = new Set(["pending", "under_review", "approved", "pending_documents"]);

export const metadata = { title: "Reservation · BX Reservations" };

function statusChip(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:            { label: "Requested",   bg: "#FEF9C3", color: "#713F12" },
    under_review:       { label: "In Review",   bg: "#E0E7FF", color: "#3730A3" },
    needs_info:         { label: "Info Needed", bg: "#FEF3C7", color: "#92400E" },
    pending_documents:  { label: "Docs Needed", bg: "#FEF3C7", color: "#92400E" },
    pending_payment:    { label: "Payment Due", bg: "#FEF3C7", color: "#92400E" },
    approved:           { label: "Approved",    bg: "#D1FAE5", color: "#065F46" },
    confirmed:          { label: "Confirmed",   bg: "#D1FAE5", color: "#065F46" },
    completed:          { label: "Completed",   bg: "#F3F4F6", color: "#374151" },
    rejected:           { label: "Not Approved",bg: "#FEE2E2", color: "#991B1B" },
    cancelled:          { label: "Cancelled",   bg: "#F3F4F6", color: "#374151" },
    cancelled_by_admin: { label: "Cancelled",   bg: "#FEE2E2", color: "#991B1B" },
    cancelled_by_user:  { label: "Cancelled",   bg: "#F3F4F6", color: "#374151" },
    auto_cancelled:     { label: "Expired",     bg: "#F3F4F6", color: "#374151" },
  };
  const s = map[status] ?? { label: status, bg: "#F3F4F6", color: "#374151" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "9999px",
        fontSize: "0.8125rem",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--bx-slate)",
          marginBottom: "0.2rem",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.9375rem", color: "var(--bx-parchment)", lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  );
}

// The reserve form stores the schedule in `payload` — there are no start_date / space columns.
interface PayloadRoom { roomId?: string; setup?: string; customSetup?: string; role?: string }
interface PayloadDay { date?: string; included?: boolean; customStart?: string; customEnd?: string; headcount?: number; rooms?: PayloadRoom[] }
interface Payload { days?: PayloadDay[]; spaceMode?: string }

const COLS =
  "id, booking_number, created_at, status, event_name, space_mode, notes, contact_name, contact_email, contact_phone, contact_org, user_id, payload";

const SETUP_NAMES: Record<string, string> = {
  theater: "Theater", banquet: "Banquet", reception: "Reception", cocktail: "Cocktail",
  classroom: "Classroom", boardroom: "Boardroom", custom: "Custom",
};
const roomName = (id?: string) => ROOMS.find((r) => r.id === id)?.name ?? id ?? "";
const fmtTime = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h)) return t;
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
};
// "2026-10-21" → a local date (no timezone shift)
const localDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, role } = await getUserAndRole();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // Access is decided here, then the row is read with the service role so staff can see any reservation.
  const db = adminClient();
  const { data: reservation } = await db.from("reservations").select(COLS).eq("id", id).maybeSingle();
  if (!reservation) notFound();

  const isOwner =
    reservation.user_id === user.id ||
    (reservation.contact_email ?? "").toLowerCase() === user.email.toLowerCase();
  const staff = isStaffRole(role);
  let isCollab = false;
  if (!isOwner && !staff) {
    const { data: collab } = await db
      .from("reservation_collaborators")
      .select("id")
      .eq("reservation_id", id)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .maybeSingle();
    if (!collab) notFound();
    isCollab = true;
  }

  // Rooms named or set up on the event map (the card below shows progress), and the logo
  const [{ count: labelCount }, logoRow] = await Promise.all([
    db.from("reservation_map_labels").select("id", { count: "exact", head: true }).eq("reservation_id", id),
    readLogoRow(db, id),
  ]);
  const logo = logoRow ? await logoState(db, logoRow) : null;

  return renderPage(reservation, {
    isCollab,
    staffView: staff && !isOwner,
    staff,
    canEdit: isOwner || staff, // accepted co-owners edit through the event map API; viewers only look
    labelCount: labelCount ?? 0,
    logo,
  });
}

function renderPage(
  reservation: {
    id: string;
    booking_number?: string | null;
    created_at: string;
    status: string;
    event_name?: string | null;
    space_mode?: string | null;
    notes?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    contact_org?: string | null;
    payload?: unknown;
  },
  view: { isCollab: boolean; staffView: boolean; staff: boolean; canEdit: boolean; labelCount: number; logo: LogoState | null; agreement?: { customer_signed_at: string | null; token: string } | null }
) {
  const submittedDate = new Date(reservation.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Schedule lives in the payload: one entry per included day, each with its rooms
  const payload = reservation.payload as Payload | null;
  const days = (payload?.days ?? [])
    .filter((d) => d && d.date && d.included !== false)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const long = (ymd: string) =>
    localDate(ymd).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const startDate =
    days.length === 0 ? null
    : days.length === 1 ? long(days[0].date!)
    : `${localDate(days[0].date!).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })} – ${long(days[days.length - 1].date!)}`;
  const spaces = [...new Set(days.flatMap((d) => (d.rooms ?? []).map((r) => roomName(r.roomId)).filter(Boolean)))];
  const spaceLine = spaces.join(", ") || null;
  const headcount = Math.max(0, ...days.map((d) => Number(d.headcount) || 0)) || null;

  return (
    <main style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>

      {/* Back link */}
      <Link
        href="/reservations"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.875rem",
          color: "var(--bx-slate)",
          textDecoration: "none",
          marginBottom: "1.25rem",
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        My Reservations
      </Link>

      {/* Header card */}
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "1rem",
          background: "var(--bx-ink-soft)",
        }}
      >
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.125rem", fontWeight: 700, color: "var(--bx-parchment)" }}>
                {reservation.event_name || spaceLine || "Reservation"}
              </h1>
              {reservation.booking_number && (
                <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)" }}>
                  {reservation.booking_number}
                </div>
              )}
            </div>
            {statusChip(reservation.status)}
            {reservation.status === "under_review" && (
              <p style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.5rem" }}>
                We&#8217;ve sent a proposal for your review &#8212; check your email for the Facility Use Agreement link to sign.
              </p>
            )}
          </div>

          {startDate && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)",
                border: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
                fontSize: "0.875rem",
                color: "var(--bx-parchment)",
                fontWeight: 500,
              }}
            >
              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{display:"inline",verticalAlign:"-0.15em"}}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> {startDate}
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
            padding: "0.75rem 1.5rem",
            fontSize: "0.8125rem",
            color: "var(--bx-slate)",
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <span>Submitted {submittedDate}</span>
          {view.staffView && <span>Staff view</span>}
          {view.isCollab && <span>Shared with you</span>}
        </div>
      </div>

      {/* Status explanation + self-cancel ─────────────────────────────────── */}
      {(() => {
        const meta = STATUS_META[reservation.status];
        const exp  = STATUS_EXPLANATION[reservation.status];
        if (!meta || !exp) return null;
        const isTerminal = ["cancelled","cancelled_by_admin","cancelled_by_user","auto_cancelled","completed"].includes(reservation.status);
        const isGood     = ["confirmed","approved"].includes(reservation.status);
        const isBad      = isTerminal && reservation.status !== "completed";
        const accent     = isGood ? "#10B981" : isBad ? "#EF4444" : meta.dot;
        return (
          <div
            style={{
              background: `color-mix(in srgb, ${accent} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: exp.detail ? "0.35rem" : 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent, flex: "none", display: "inline-block" }} />
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--bx-parchment)" }}>{exp.headline}</span>
            </div>
            {exp.detail && (
              <p style={{ margin: "0 0 0 1.625rem", fontSize: "0.875rem", color: "var(--bx-slate)", lineHeight: 1.55 }}>{exp.detail}</p>
            )}
            {SELF_CANCEL_STATUSES.has(reservation.status) && !view.staffView && (
              <div style={{ marginTop: "0.875rem", marginLeft: "1.625rem" }}>
                <SelfCancelButton reservationId={reservation.id} />
              </div>
            )}
          </div>
        );
      })()}

      {/* Event map */}
      <Link
        href={`/reservations/${reservation.id}/event-map`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          border: "1px solid color-mix(in srgb, var(--bx-brass) 35%, transparent)",
          borderRadius: "12px",
          padding: "1rem 1.25rem",
          marginBottom: "1rem",
          background: "color-mix(in srgb, var(--bx-brass) 8%, var(--bx-ink-soft))",
          textDecoration: "none",
          color: "var(--bx-parchment)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--bx-brass)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Event map</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.15rem", lineHeight: 1.4 }}>
            {view.labelCount > 0
              ? `${view.labelCount} ${view.labelCount === 1 ? "room is" : "rooms are"} named or set up for this event. Open the map to review or change the plan.`
              : "Name each room for your event and tell us how to set it up. Everything saves to this reservation."}
          </div>
        </div>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", color: "var(--bx-slate)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>

      {/* Event logo — goes on the event map header and the door signs, after staff approve it */}
      {view.logo && (
        <EventLogoCard reservationId={reservation.id} initial={view.logo} canEdit={view.canEdit} staff={view.staff} />
      )}

      {/* Door signs — generated from the event map on BX's locked template; the logo is the only variable */}
      {view.logo && (() => {
        const gate = signsUnlocked({ status: reservation.status, logo_status: view.logo.status }, view.staff);
        const api = `/api/event-map/${reservation.id}/signs`;
        const btn = (primary: boolean): React.CSSProperties => ({
          display: "inline-block",
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          textDecoration: "none",
          background: primary ? "var(--bx-brass)" : "transparent",
          color: primary ? "#fff" : "var(--bx-parchment)",
          border: primary ? "1px solid transparent" : "1px solid color-mix(in srgb, var(--bx-parchment) 20%, transparent)",
          opacity: gate.ok ? 1 : 0.45,
          pointerEvents: gate.ok ? "auto" : "none",
        });
        return (
          <section
            aria-label="Door signs"
            style={{
              border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
              borderRadius: "12px",
              padding: "1.25rem 1.5rem",
              marginBottom: "1rem",
              background: "var(--bx-ink-soft)",
              color: "var(--bx-parchment)",
            }}
          >
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bx-slate)" }}>
              Door signs
            </h2>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", lineHeight: 1.5, color: "var(--bx-slate)" }}>
              One sign for every reserved room and one for each wayfinding note, from the event map, on BX&apos;s template
              {view.logo.status === "approved" ? " with your logo" : ""}. Letter size, ready to print — regenerate any time a name changes.
            </p>
            {!gate.ok && (
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "#92400E" }}>{gate.why}</p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <a href={api} style={btn(true)} aria-disabled={!gate.ok}>Download all signs (PDF)</a>
              <a href={`${api}?inline=1`} target="_blank" rel="noopener" style={btn(false)} aria-disabled={!gate.ok}>Preview</a>
              {view.staff && (
                <a href={`${api}?variant=staff`} style={btn(false)}>Staff copy (with setups)</a>
              )}
            </div>
          </section>
        );
      })()}

      {/* Details card */}
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "1rem",
          background: "var(--bx-ink-soft)",
        }}
      >
        <h2
          style={{
            margin: "0 0 1rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bx-slate)",
          }}
        >
          Details
        </h2>

        <Field label="Space" value={spaceLine} />
        <Field label="Event name" value={reservation.event_name} />
        <Field label="Expected attendance" value={headcount ? `${headcount} people` : null} />
        <Field label="Notes" value={reservation.notes} />

        {days.length > 0 && (
          <div style={{ marginBottom: "0.5rem" }}>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--bx-slate)",
                marginBottom: "0.5rem",
              }}
            >
              Schedule
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {days.map((day, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.625rem 0.875rem",
                    borderRadius: "8px",
                    border: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
                    fontSize: "0.875rem",
                    color: "var(--bx-parchment)",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {localDate(day.date!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {day.customStart && day.customEnd ? (
                      <span style={{ fontWeight: 400, color: "var(--bx-slate)" }}> · {fmtTime(day.customStart)} – {fmtTime(day.customEnd)}</span>
                    ) : null}
                  </div>
                  {(day.rooms ?? []).length > 0 && (
                    <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.1rem" }}>
                      {(day.rooms ?? [])
                        .map((r) => {
                          const setup = r.setup === "custom" && r.customSetup ? r.customSetup : SETUP_NAMES[r.setup ?? ""] ?? r.setup;
                          return setup ? `${roomName(r.roomId)} · ${setup}` : roomName(r.roomId);
                        })
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contact info */}
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          background: "var(--bx-ink-soft)",
        }}
      >
        <h2
          style={{
            margin: "0 0 1rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bx-slate)",
          }}
        >
          Contact
        </h2>
        <Field label="Name" value={reservation.contact_name} />
        <Field label="Organization" value={reservation.contact_org} />
        <Field label="Email" value={reservation.contact_email} />
        <Field label="Phone" value={reservation.contact_phone} />
      </div>

      {/* Agreement signing card — show if there's an unsent/unsigned agreement */}
      {!view.staffView && view.agreement && !view.agreement.customer_signed_at && (
        <div style={{ border: "1px solid color-mix(in srgb, #C5A95A 35%, transparent)", borderRadius: "12px", padding: "1.25rem 1.5rem", marginBottom: "1rem", background: "color-mix(in srgb, #C5A95A 6%, transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#C5A95A", display: "inline-block" }} />
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--bx-parchment)" }}>Signature Required</span>
          </div>
          <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--bx-slate)", lineHeight: 1.55 }}>
            Please review and sign your Facility Use Agreement to continue with your reservation.
          </p>
          <a
            href={`/reservations/${reservation.id}/agreement?token=${view.agreement.token}`}
            style={{ display: "inline-block", background: "#C5A95A", color: "#1a1a1a", padding: "0.625rem 1.25rem", borderRadius: 8, fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}
          >
            Review &amp; Sign Agreement →
          </a>
        </div>
      )}

      {/* Agreement signed confirmation */}
      {!view.staffView && view.agreement?.customer_signed_at && (
        <div style={{ border: "1px solid #6EE7B7", borderRadius: "12px", padding: "0.875rem 1.25rem", marginBottom: "1rem", background: "color-mix(in srgb, #10B981 8%, transparent)" }}>
          <span style={{ fontSize: "0.875rem", color: "#6EE7B7", fontWeight: 600 }}>✓ Facility Use Agreement signed</span>
        </div>
      )}

      {/* COI upload card — show when pending_documents and not yet accepted */}
      {!view.staffView && reservation.status === "pending_documents" && !(reservation as Record<string, unknown>).coi_accepted_at && (
        <div style={{ marginBottom: "1rem" }}>
          <COIUploadCard reservationId={reservation.id} />
        </div>
      )}

      {/* COI accepted confirmation */}
      {!view.staffView && !!(reservation as Record<string, unknown>).coi_accepted_at && (
        <div style={{ border: "1px solid #6EE7B7", borderRadius: "12px", padding: "0.875rem 1.25rem", marginBottom: "1rem", background: "color-mix(in srgb, #10B981 8%, transparent)" }}>
          <span style={{ fontSize: "0.875rem", color: "#6EE7B7", fontWeight: 600 }}>✓ Certificate of Insurance verified</span>
        </div>
      )}


      {/* Messages thread */}
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "1rem",
          background: "var(--bx-ink-soft)",
        }}
      >
        <h2
          style={{
            margin: "0 0 1rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bx-slate)",
          }}
        >
          Messages
        </h2>
        <CommentsThread
          reservationId={reservation.id}
          fetchUrl={`/api/reservations/${reservation.id}/comments`}
          postUrl={`/api/reservations/${reservation.id}/comments`}
          autoLoad={true}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link
          href="/reservations"
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
            color: "var(--bx-parchment)",
            textDecoration: "none",
          }}
        >
          ← Back to reservations
        </Link>
        <Link
          href="/reserve"
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: "var(--bx-brass)",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          New request
        </Link>
      </div>
    </main>
  );
}
