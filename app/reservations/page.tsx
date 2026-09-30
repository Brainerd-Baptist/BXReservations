import { redirect } from "next/navigation";
import { loginHref } from "@/lib/return-path";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import ReservationList from "./ReservationList";
import { includedDates, isUpcoming, formatYmd } from "@/lib/dates";
import type { Reservation, Collab } from "./ReservationList";

export const metadata = { title: "My Reservations · BX Reservations" };

const firstDate = (payload: unknown) => includedDates(payload)[0] ?? null;

export default async function ReservationsPage() {
  const { user } = await getUserAndRole();
  if (!user) redirect(loginHref("/reservations"));

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies are read-only here; middleware refreshes the session.
          }
        },
      },
    }
  );

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, booking_number, created_at, status, event_name, payload")
    .or(`user_id.eq.${user.id},contact_email.eq.${user.email}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: pendingInvites } = await supabase
    .from("reservation_collaborators")
    .select("id, invite_token, collab_role, created_at, reservations(id, event_name, payload)")
    .eq("invited_email", (user.email ?? "").toLowerCase())
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const { data: sharedCollabs } = await supabase
    .from("reservation_collaborators")
    .select("id, collab_role, reservations(id, event_name, payload, status)")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  // Upcoming until the LAST included day is over, in venue time; every
  // cancellation variant counts as closed (audit F09).
  const all = (reservations ?? []) as Reservation[];
  const upcoming: Reservation[] = all
    .filter((r) => isUpcoming(r.status, r.payload))
    .sort((a, b) => (firstDate(a.payload) ?? "9999").localeCompare(firstDate(b.payload) ?? "9999"));
  const past: Reservation[] = all.filter((r) => !isUpcoming(r.status, r.payload));

  return (
    <div className="animate-in" style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>

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

      {/* ── Pending invites (server-rendered, no hover handlers) ── */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="bx-fade-in" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--bx-accent-text)",
              }}
            >
              Pending invites
            </h2>
            <span
              style={{
                padding: "1px 7px",
                borderRadius: "9999px",
                fontSize: "0.7rem",
                fontWeight: 700,
                background: "color-mix(in srgb, var(--bx-brass) 20%, transparent)",
            boxShadow: "var(--shadow-warm)",
                color: "var(--bx-accent-text)",
              }}
            >
              {pendingInvites.length}
            </span>
          </div>
          <div
            style={{
              border: "1px solid color-mix(in srgb, var(--bx-brass) 25%, transparent)",
              borderRadius: "12px",
              overflow: "hidden",
              background: "color-mix(in srgb, var(--bx-brass) 5%, transparent)",
            boxShadow: "var(--shadow-warm)",
            }}
          >
            {pendingInvites.map((inv, i) => {
              const res = inv.reservations as unknown as { id: string; event_name?: string; payload?: unknown } | null;
              const p = res?.payload as { days?: Array<{ date?: string; rooms?: Array<{ roomId?: string }> }> } | null;
              const startDate = includedDates(p)[0] ?? null;
              const label = res?.event_name || "A reservation";
              const dateStr = startDate ? formatYmd(startDate) : null;
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

      {/* ── Upcoming / Shared / Past (client component handles hover) ── */}
      <ReservationList
        upcoming={upcoming}
        sharedCollabs={(sharedCollabs ?? []) as unknown as Collab[]}
        past={past}
      />

      {/* ── Empty state when nothing at all ── */}
      {(!reservations || reservations.length === 0) &&
        (!pendingInvites || pendingInvites.length === 0) &&
        (!sharedCollabs || sharedCollabs.length === 0) && (
        <div style={{ textAlign: "center", padding: "4rem 1.5rem", color: "var(--bx-slate)" }}>
          <div style={{ marginBottom: "0.75rem", color: "var(--bx-slate)" }}>
            <svg width="2.5rem" height="2.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "block", margin: "0 auto" }}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
          </div>
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
    </div>
  );
}
