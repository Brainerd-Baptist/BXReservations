import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import SignOutButton from "./sign-out-button";
import ProfileForm from "./profile-form";
import ThemeGrid from "../components/theme-grid";
import NotificationPreferencesSection, {
  type BxNotificationPrefs,
} from "../components/notification-preferences-section";

export default async function AccountPage() {
  const { user, role, profile } = await getUserAndRole();
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
    .select("id, created_at, status, event_name, space, start_date")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch user prefs (theme + notification toggles)
  const { data: userPrefs } = await supabase
    .from("bx_user_prefs")
    .select("theme, notify_reservation_confirmed, notify_reservation_reminder, notify_admin_message")
    .eq("user_id", user.id)
    .single();

  const initialNotifPrefs: BxNotificationPrefs = {
    notify_reservation_confirmed: userPrefs?.notify_reservation_confirmed ?? true,
    notify_reservation_reminder: userPrefs?.notify_reservation_reminder ?? true,
    notify_admin_message: userPrefs?.notify_admin_message ?? true,
  };

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  const statusChip = (status: string) => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      pending:   { label: "Pending",   bg: "#FEF3C7", color: "#92400E" },
      approved:  { label: "Approved",  bg: "#D1FAE5", color: "#065F46" },
      rejected:  { label: "Rejected",  bg: "#FEE2E2", color: "#991B1B" },
      cancelled: { label: "Cancelled", bg: "#F3F4F6", color: "#374151" },
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
        }}
      >
        {s.label}
      </span>
    );
  };

  return (
    <main style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>

      {/* ── Profile header card ── */}
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "1.5rem",
          background: "var(--bx-ink-soft)",
        }}
      >
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "var(--bx-parchment)",
              color: "var(--bx-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--bx-parchment)" }}>
              {profile?.display_name || user.email}
            </div>
            {profile?.display_name && (
              <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.1rem" }}>
                {user.email}
              </div>
            )}
            {profile?.organization && (
              <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.1rem" }}>
                {profile.organization}
              </div>
            )}
            <div style={{ marginTop: "0.35rem" }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background:
                    role === "admin"
                      ? "var(--bx-parchment)"
                      : "color-mix(in srgb, var(--bx-slate) 20%, transparent)",
                  color: role === "admin" ? "var(--bx-ink)" : "var(--bx-slate)",
                }}
              >
                {role === "admin" ? "Admin" : "User"}
              </span>
            </div>
          </div>
        </div>

        {role === "admin" && (
          <div
            style={{
              borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
              padding: "0.875rem 1.5rem",
            }}
          >
            <Link
              href="/admin/bx-reservations"
              style={{ color: "var(--bx-brass)", fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none" }}
            >
              Admin dashboard →
            </Link>
          </div>
        )}
      </div>

      {/* ── Editable contact info ── */}
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
          Contact info
        </h2>
        <ProfileForm
          displayName={profile?.display_name ?? null}
          phone={profile?.phone ?? null}
          organization={profile?.organization ?? null}
          email={user.email}
        />
      </div>

      {/* ── Appearance (theme picker) ── */}
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
            margin: "0 0 0.25rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bx-slate)",
          }}
        >
          Appearance
        </h2>
        <p style={{ fontSize: "0.75rem", color: "var(--bx-slate)", margin: "0 0 1rem", opacity: 0.8 }}>
          Choose a color theme. Your preference is saved and applied on every device.
        </p>
        <ThemeGrid userId={user.id} savedTheme={userPrefs?.theme ?? null} />
      </div>

      {/* ── Notification preferences ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <NotificationPreferencesSection
          userId={user.id}
          initialPrefs={initialNotifPrefs}
        />
      </div>

      {/* ── My reservations ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
              color: "var(--bx-slate)",
            }}
          >
            My reservations
          </h2>
          <Link
            href="/reserve"
            style={{ fontSize: "0.875rem", color: "var(--bx-brass)", fontWeight: 600, textDecoration: "none" }}
          >
            + New request
          </Link>
        </div>

        <div
          style={{
            border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
            borderRadius: "12px",
            overflow: "hidden",
            background: "var(--bx-ink-soft)",
          }}
        >
          {!reservations || reservations.length === 0 ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "var(--bx-slate)" }}>
              <p style={{ margin: "0 0 0.5rem" }}>No reservations yet.</p>
              <Link href="/reserve" style={{ color: "var(--bx-brass)", fontWeight: 600, textDecoration: "none" }}>
                Make your first reservation →
              </Link>
            </div>
          ) : (
            reservations.map((r, i) => (
              <div
                key={r.id}
                style={{
                  padding: "0.875rem 1.25rem",
                  borderTop:
                    i === 0
                      ? "none"
                      : "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--bx-parchment)" }}>
                    {r.event_name || r.space || "Reservation"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", marginTop: "0.15rem" }}>
                    {r.start_date
                      ? new Date(r.start_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                  </div>
                </div>
                {statusChip(r.status)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Sign out ── */}
      <SignOutButton />
    </main>
  );
}
