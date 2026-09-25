import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const metadata = { title: "Reservation · BX Reservations" };

function statusChip(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: "Pending",   bg: "#FEF3C7", color: "#92400E" },
    approved:  { label: "Approved",  bg: "#D1FAE5", color: "#065F46" },
    rejected:  { label: "Rejected",  bg: "#FEE2E2", color: "#991B1B" },
    cancelled: { label: "Cancelled", bg: "#F3F4F6", color: "#374151" },
    under_review: { label: "In Review", bg: "#E0E7FF", color: "#3730A3" },
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

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getUserAndRole();
  if (!user) redirect("/login");

  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, booking_number, created_at, status, event_name, space, space_mode, start_date, notes, contact_name, contact_email, contact_phone, payload")
    .eq("id", id)
    .or(`user_id.eq.${user.id},contact_email.eq.${user.email}`)
    .maybeSingle();

  // Also allow collaborators to view
  let allowed = !!reservation;
  if (!allowed) {
    const { data: collab } = await supabase
      .from("reservation_collaborators")
      .select("id")
      .eq("reservation_id", id)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .maybeSingle();
    if (collab) {
      // Re-fetch without user filter
      const { data: res } = await supabase
        .from("reservations")
        .select("id, booking_number, created_at, status, event_name, space, space_mode, start_date, notes, contact_name, contact_email, contact_phone, payload")
        .eq("id", id)
        .maybeSingle();
      if (res) {
        allowed = true;
        // Use this data
        return renderPage(res, user.id, true);
      }
    }
    if (!allowed) notFound();
  }

  return renderPage(reservation!, user.id, false);
}

function renderPage(
  reservation: {
    id: string;
    booking_number?: string | null;
    created_at: string;
    status: string;
    event_name?: string | null;
    space?: string | null;
    space_mode?: string | null;
    start_date?: string | null;
    notes?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    payload?: unknown;
  },
  _userId: string,
  _isCollab: boolean
) {
  const submittedDate = new Date(reservation.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const startDate = reservation.start_date
    ? new Date(reservation.start_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Extract days from payload if available
  const payload = reservation.payload as { days?: { date: string; startTime: string; endTime: string; setup: string }[] } | null;
  const days = payload?.days ?? [];

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
                {reservation.event_name || reservation.space || "Reservation"}
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
          }}
        >
          Submitted {submittedDate}
        </div>
      </div>

      {/* Status message */}
      {reservation.status === "pending" && (
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
      {reservation.status === "approved" && (
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

        <Field label="Space" value={reservation.space} />
        <Field label="Event name" value={reservation.event_name} />
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
                    {new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.1rem" }}>
                    {day.startTime} – {day.endTime}
                    {day.setup ? ` · ${day.setup}` : ""}
                  </div>
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
