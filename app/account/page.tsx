import { redirect } from "next/navigation";
import { loginHref } from "@/lib/return-path";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import SignOutButton from "./sign-out-button";
import ProfileForm from "./profile-form";
import ThemeGrid from "../components/theme-grid";
import NotificationPreferencesSection, {
  type BxNotificationPrefs,
} from "../components/notification-preferences-section";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, role, profile } = await getUserAndRole();
  if (!user) redirect(loginHref("/account"));

  const params = await searchParams;
  const isFirstVisit = params.welcome === "1";

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
            // Server Component — read-only cookie store; middleware handles refresh.
          }
        },
      },
    }
  );




  // Fetch user prefs (theme + notification toggles)
  const { data: userPrefs } = await supabase
    .from("bx_user_prefs")
    .select("theme, show_grid, show_grid_lines, notify_reservation_confirmed, notify_reservation_reminder, notify_admin_message")
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


  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>

      {/* ── First-run welcome banner ── */}
      {isFirstVisit && (
        <div
          className="bx-fade-in"
          style={{
            background: "color-mix(in srgb, var(--bx-brass) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--bx-brass) 30%, transparent)",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            gap: "0.875rem",
            alignItems: "flex-start",
          }}
        >
          <span style={{ lineHeight: 1, marginTop: "0.1rem", color: "var(--bx-accent-text)" }}><svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{display:"inline",verticalAlign:"-0.2em"}}><path d="M7.5 5.5C7.5 4.1 8.6 3 10 3s2.5 1.1 2.5 2.5v5.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V5.5"/><path d="M4.5 8C4.5 6.6 5.6 5.5 7 5.5"/><path d="M3 12.5C3 11.1 4.1 10 5.5 10"/><path d="M20.5 12.5C20.5 14.9 18.5 20 12 21 6 21 3.5 16.5 3.5 13.5"/></svg></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--bx-parchment)", marginBottom: "0.2rem" }}>
              You&apos;re in{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}!
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", lineHeight: 1.5 }}>
              Add your phone number below so our team can reach you about your reservation requests.
            </div>
            {/* What to expect timeline */}
            <div style={{ marginTop: "0.875rem", paddingTop: "0.875rem", borderTop: "1px solid color-mix(in srgb, var(--bx-brass) 20%, transparent)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--bx-accent-text)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                What happens after you submit a request
              </div>
              {[
                { step: "1", label: "Requested", desc: "We receive your request and review availability." },
                { step: "2", label: "Proposal Sent", desc: "We send you a Facility Use Agreement to sign by email." },
                { step: "3", label: "Confirmed", desc: "Once signed by both parties, your booking is locked in." },
              ].map(({ step, label, desc }) => (
                <div key={step} style={{ display: "flex", gap: "0.625rem", marginBottom: "0.5rem", alignItems: "flex-start" }}>
                  <div style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                    background: "color-mix(in srgb, var(--bx-brass) 25%, transparent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.6875rem", fontWeight: 700, color: "var(--bx-accent-text)",
                  }}>{step}</div>
                  <div>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--bx-parchment)" }}>{label}</span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--bx-slate)" }}> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile header card ── */}
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "1.5rem",
          background: "var(--bx-surface)", backdropFilter: "blur(var(--bx-blur)) saturate(150%)", WebkitBackdropFilter: "blur(var(--bx-blur)) saturate(150%)", boxShadow: "inset 0 1px 0 var(--bx-highlight), var(--shadow-2)",
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
                    can.viewAdminPanel(role)
                      ? "var(--bx-parchment)"
                      : "color-mix(in srgb, var(--bx-slate) 20%, transparent)",
                  color: can.viewAdminPanel(role) ? "var(--bx-ink)" : "var(--bx-slate)",
                }}
              >
                {can.viewAdminPanel(role) ? "Admin" : "User"}
              </span>
            </div>
          </div>
        </div>

        {can.viewAdminPanel(role) && (
          <div
            style={{
              borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
              padding: "0.875rem 1.5rem",
            }}
          >
            <Link
              href="/admin/bx-reservations"
              style={{ color: "var(--bx-accent-text)", fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none" }}
            >
              Admin dashboard →
            </Link>
          </div>
        )}
      </div>

      {/* ── Editable contact info ── */}
      <div
        id="profile"
        style={{ scrollMarginTop: "calc(var(--bx-header-h) + 1rem)",
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          background: "var(--bx-surface)", backdropFilter: "blur(var(--bx-blur)) saturate(150%)", WebkitBackdropFilter: "blur(var(--bx-blur)) saturate(150%)", boxShadow: "inset 0 1px 0 var(--bx-highlight), var(--shadow-2)",
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
          background: "var(--bx-surface)", backdropFilter: "blur(var(--bx-blur)) saturate(150%)", WebkitBackdropFilter: "blur(var(--bx-blur)) saturate(150%)", boxShadow: "inset 0 1px 0 var(--bx-highlight), var(--shadow-2)",
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
          Auto follows your device (the default), or pick Light or Dark. Saved to your account, so it follows you to every phone and computer.
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

      {/* ── Sign out ── */}
      <SignOutButton />
    </div>
  );
}
