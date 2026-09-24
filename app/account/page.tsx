import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import SignOutButton from "./sign-out-button";
import ProfileForm from "./profile-form";

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
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#00205B",
              color: "#fff",
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
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#111" }}>
              {profile?.display_name || user.email}
            </div>
            {profile?.display_name && (
              <div style={{ fontSize: "0.8125rem", color: "#666", marginTop: "0.1rem" }}>
                {user.email}
              </div>
            )}
            {profile?.organization && (
              <div style={{ fontSize: "0.8125rem", color: "#888", marginTop: "0.1rem" }}>
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
                  background: role === "admin" ? "#00205B" : "#E5E7EB",
                  color: role === "admin" ? "#fff" : "#374151",
                }}
              >
                {role === "admin" ? "Admin" : "User"}
              </span>
            </div>
          </div>
        </div>

        {role === "admin" && (
          <div style={{ borderTop: "1px solid #f0f0f0", padding: "0.875rem 1.5rem" }}>
            <Link
              href="/admin/bx-reservations"
              style={{ color: "#00205B", fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none" }}
            >
              Admin dashboard →
            </Link>
          </div>
        )}
      </div>

      {/* ── Editable contact info ── */}
      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2
          style={{
            margin: "0 0 1rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#666",
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
              color: "#666",
            }}
          >
            My reservations
          </h2>
          <Link
            href="/reserve"
            style={{ fontSize: "0.875rem", color: "#00abc9", fontWeight: 600, textDecoration: "none" }}
          >
            + New request
          </Link>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: "12px", overflow: "hidden" }}>
          {!reservations || reservations.length === 0 ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "#666" }}>
              <p style={{ margin: "0 0 0.5rem" }}>No reservations yet.</p>
              <Link href="/reserve" style={{ color: "#00abc9", fontWeight: 600, textDecoration: "none" }}>
                Make your first reservation →
              </Link>
            </div>
          ) : (
            reservations.map((r, i) => (
              <div
                key={r.id}
                style={{
                  padding: "0.875rem 1.25rem",
                  borderTop: i === 0 ? "none" : "1px solid #f0f0f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#111" }}>
                    {r.event_name || r.space || "Reservation"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#888", marginTop: "0.15rem" }}>
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
