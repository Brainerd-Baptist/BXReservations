import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient, isStaffRole } from "@/lib/event-map";
import { ROOMS } from "@/lib/rooms";

export const metadata = { title: "Reservation · BX Reservations" };

function statusChip(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending_insurance: { label: "Pending insurance", bg: "#FEF3C7", color: "#92400E" },
    pending:   { label: "Pending",   bg: "#FEF3C7", color: "#92400E" },
    under_review: { label: "In Review", bg: "#E0E7FF", color: "#3730A3" },
    approved:  { label: "Approved",  bg: "#D1FAE5", color: "#065F46" },
    confirmed: { label: "Confirmed", bg: "#D1FAE5", color: "#065F46" },
    completed: { label: "Completed", bg: "#F3F4F6", color: "#374151" },
    rejected:  { label: "Rejected",  bg: "#FEE2E2", color: "#991B1B" },
    cancelled: { label: "Cancelled", bg: "#F3F4F6", color: "#374151" },
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

  // Rooms named or set up on the event map (the card below shows progress)
  const { count: labelCount } = await db
    .from("reservation_map_labels")
    .select("id", { count: "exact", head: true })
    .eq("reservation_id", id);

  return renderPage(reservation, { isCollab, staffView: staff && !isOwner, labelCount: labelCount ?? 0 });
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
  view: { isCollab: boolean; staffView: boolean; labelCount: number }
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
              📅 {startDate}
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

      {/* Status message */}
      {(reservation.status === "pending" || reservation.status === "pending_insurance" || reservation.status === "under_review") && (
        <div
          style={{
            background: "color-mix(in srgb, #F59E0B 12%, transparent)",
            border: "1px solid color-mix(in srgb, #F59E0B 30%, transparent)",
            borderRadius: "10px",
            padding: "0.875rem 1.125rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
            color: "var(--bx-parchment)",
          }}
        >
          ⏳ Your request is pending review. Our team will reach out once it&apos;s been processed.
        </div>
      )}
      {(reservation.status === "approved" || reservation.status === "confirmed") && (
        <div
          style={{
            background: "color-mix(in srgb, #10B981 12%, transparent)",
            border: "1px solid color-mix(in srgb, #10B981 30%, transparent)",
            borderRadius: "10px",
            padding: "0.875rem 1.125rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
            color: "var(--bx-parchment)",
          }}
        >
          ✅ This reservation has been approved. See you there!
        </div>
      )}
      {reservation.status === "rejected" && (
        <div
          style={{
            background: "color-mix(in srgb, #EF4444 10%, transparent)",
            border: "1px solid color-mix(in srgb, #EF4444 25%, transparent)",
            borderRadius: "10px",
            padding: "0.875rem 1.125rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
            color: "var(--bx-parchment)",
          }}
        >
          ❌ This request was not approved. Please contact us if you have questions.
        </div>
      )}

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

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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
          Back to reservations
        </Link>
      </div>
    </main>
  );
}
