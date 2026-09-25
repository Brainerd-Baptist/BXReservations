import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const metadata = { title: "My Reservations · BX Reservations" };

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
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
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

export default async function ReservationsPage() {
  const { user } = await getUserAndRole();
  if (!user) redirect("/login");

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

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, booking_number, created_at, status, event_name, space, start_date")
    .or(`user_id.eq.${user.id},contact_email.eq.${user.email}`)
    .order("start_date", { ascending: false })
    .limit(50);

  const { data: pendingInvites } = await supabase
    .from("reservation_collaborators")
    .select("id, invite_token, collab_role, created_at, reservations(id, event_name, start_date, space)")
    .eq("invited_email", (user.email ?? "").toLowerCase())
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const { data: sharedCollabs } = await supabase
    .from("reservation_collaborators")
    .select("id, collab_role, reservations(id, event_name, start_date, space, status)")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const now = new Date();
  const upcoming = (reservations ?? []).filter(
    (r) => r.status !== "cancelled" && r.status !== "rejected" && new Date(r.start_date ?? r.created_at) >= now
  );
  const past = (reservations ?? []).filter(
    (r) => r.status === "cancelled" || r.status === "rejected" || new Date(r.start_date ?? r.created_at) < now
  );

  const sectionHeader = (label: string, count?: number, badge?: { label: string }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "0.75rem",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: badge ? "var(--bx-brass)" : "var(--bx-slate)",
        }}
      >
        {label}
      </h2>
      {badge && (
        <span
          style={{
            padding: "1px 7px",
            borderRadius: "9999px",
            fontSize: "0.7rem",
            fontWeight: 700,
            background: "color-mix(in srgb, var(--bx-brass) 20%, transparent)",
            color: "var(--bx-brass)",
          }}
        >
          {badge.label}
        </span>
      )}
      {!badge && count !== undefined && count > 0 && (
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

  return (
    <main style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>

      {/* Page title */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.75rem",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--bx-parchment)",
          }}
        >
          My Reservations
        </h1>
        <Link
          href="/reserve"
          style={{
            padding: "0.4375rem 0.875rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: "var(--bx-brass)",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          + New request
        </Link>
      </div>

      {/* ── Pending invites ── */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="bx-fade-in" style={{ marginBottom: "1.5rem" }}>
          {sectionHeader("Pending invites", undefined, { label: String(pendingInvites.length) })}
          <div
            style={{
              border: "1px solid color-mix(in srgb, var(--bx-brass) 25%, transparent)",
              borderRadius: "12px",
              overflow: "hidden",
              background: "color-mix(in srgb, var(--bx-brass) 5%, transparent)",
            }}
          >
            {pendingInvites.map((inv, i) => {
              const res = inv.reservations as unknown as { id: string; event_name?: string; start_date?: string; space?: string } | null;
              const label = res?.event_name || res?.space || "A reservation";
              const dateStr = res?.start_date
                ? new Date(res.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null;
              const roleLabel = inv.collab_role === "co_owner" ? "Co-owner" : "Viewer";
              return (
                <div
                  key={inv.id}
                  style={{
                    padding: "0.875rem 1.25rem",
                    borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--bx-brass) 15%, transparent)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--bx-parchment)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.15rem" }}>
                      {dateStr ? dateStr + " · " : ""}{roleLabel} access
                    </div>
                  </div>
                  {inv.invite_token && (
                    <a
                      href={"/account/invites?token=" + inv.invite_token}
                      style={{
                        padding: "0.375rem 0.875rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        background: "var(--bx-brass)",
                        color: "white",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      Accept invite →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Upcoming reservations ── */}
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
            upcoming.map((r, i) => (
              <Link
                key={r.id}
                href={`/reservations/${r.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.875rem 1.25rem",
                  borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                  textDecoration: "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "color-mix(in srgb, var(--bx-parchment) 3%, transparent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
                }
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--bx-parchment)" }}>
                    {r.event_name || r.space || "Reservation"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.15rem" }}>
                    {formatDate(r.start_date, r.created_at)}
                    {r.booking_number ? ` · ${r.booking_number}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {statusChip(r.status)}
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--bx-slate)", flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))
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
              const res = collab.reservations as unknown as { id: string; event_name?: string; start_date?: string; space?: string; status?: string } | null;
              const label = res?.event_name || res?.space || "Shared reservation";
              const dateStr = formatDate(res?.start_date);
              const roleLabel = collab.collab_role === "co_owner" ? "Co-owner" : "Viewer";
              return (
                <Link
                  key={collab.id}
                  href={res?.id ? `/reservations/${res.id}` : "#"}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.875rem 1.25rem",
                    borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                    textDecoration: "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.background = "color-mix(in srgb, var(--bx-parchment) 3%, transparent)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
                  }
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--bx-parchment)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.15rem" }}>
                      {dateStr ? dateStr + " · " : ""}{roleLabel}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {res?.status && statusChip(res.status)}
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--bx-slate)", flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Past reservations ── */}
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
            {past.map((r, i) => (
              <Link
                key={r.id}
                href={`/reservations/${r.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1.25rem",
                  borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                  textDecoration: "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "color-mix(in srgb, var(--bx-parchment) 3%, transparent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
                }
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--bx-parchment)" }}>
                    {r.event_name || r.space || "Reservation"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--bx-slate)", marginTop: "0.1rem" }}>
                    {formatDate(r.start_date, r.created_at)}
                    {r.booking_number ? ` · ${r.booking_number}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {statusChip(r.status)}
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--bx-slate)", flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when nothing at all */}
      {(!reservations || reservations.length === 0) &&
        (!pendingInvites || pendingInvites.length === 0) &&
        (!sharedCollabs || sharedCollabs.length === 0) && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 1.5rem",
            color: "var(--bx-slate)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 600, color: "var(--bx-parchment)" }}>No reservations yet</p>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem" }}>
            When you submit a space request, it'll show up here.
          </p>
          <Link
            href="/reserve"
            style={{
              display: "inline-block",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: "var(--bx-brass)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Make a reservation →
          </Link>
        </div>
      )}
    </main>
  );
}
