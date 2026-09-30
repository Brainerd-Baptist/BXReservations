import { redirect } from "next/navigation";
import { loginHref } from "@/lib/return-path";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserAndRole } from "@/lib/get-user-role";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function InvitesPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  // No token
  if (!token) {
    return (
      <div className="bx-glass animate-in" style={{ maxWidth: "440px", margin: "4rem auto", padding: "2.5rem 1.75rem", borderRadius: 18, textAlign: "center", width: "calc(100% - 2rem)" }}>
        <div style={{ marginBottom: "1rem", color: "var(--bx-slate)" }}><svg width="2.5rem" height="2.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"block",margin:"0 auto"}}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></div>
        <h1 style={{ fontSize: "1.625rem", fontWeight: 600, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Invalid invite link
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          This link is missing the invite token. Make sure you copied the full link from the email.
        </p>
        <Link href="/" style={{ color: "var(--bx-accent-text)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          Go to dashboard →
        </Link>
      </div>
    );
  }

  // Auth guard
  const { user } = await getUserAndRole();
  if (!user) {
    redirect(loginHref("/account/invites?token=" + encodeURIComponent(token)));
  }

  // Set up server supabase
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

  // Look up the invite by token
  const { data: invite, error: lookupErr } = await supabase
    .from("reservation_collaborators")
    .select("id, reservation_id, accepted_at, collab_role, invited_email")
    .eq("invite_token", token)
    .single();

  if (lookupErr || !invite) {
    return (
      <div className="bx-glass animate-in" style={{ maxWidth: "440px", margin: "4rem auto", padding: "2.5rem 1.75rem", borderRadius: 18, textAlign: "center", width: "calc(100% - 2rem)" }}>
        <div style={{ marginBottom: "1rem", color: "var(--bx-clay)" }}><svg width="2.5rem" height="2.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"block",margin:"0 auto"}}><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg></div>
        <h1 style={{ fontSize: "1.625rem", fontWeight: 600, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Invite not found
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          This invite link may have expired or already been used. Ask the reservation owner to send a new invite.
        </p>
        <Link href="/" style={{ color: "var(--bx-accent-text)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          Go to dashboard →
        </Link>
      </div>
    );
  }

  // Already accepted
  if (invite.accepted_at) {
    redirect(`/reservations/${invite.reservation_id}`); // already joined: go straight there
  }

  // Verify email matches
  if (invite.invited_email && invite.invited_email !== user.email?.toLowerCase()) {
    return (
      <div className="bx-glass animate-in" style={{ maxWidth: "440px", margin: "4rem auto", padding: "2.5rem 1.75rem", borderRadius: 18, textAlign: "center", width: "calc(100% - 2rem)" }}>
        <div style={{ marginBottom: "1rem", color: "var(--bx-accent-text)" }}><svg width="2.5rem" height="2.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"block",margin:"0 auto"}}><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg></div>
        <h1 style={{ fontSize: "1.625rem", fontWeight: 600, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Wrong account
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          This invite was sent to <strong>{invite.invited_email}</strong>.
          You are signed in as <strong>{user.email}</strong>.<br /><br />
          Sign in with the correct account to accept this invite.
        </p>
        {/* Sign out, then sign in again and land back on this invite */}
        <form action="/api/auth/sign-out" method="post">
          <input type="hidden" name="next" value={"/account/invites?token=" + encodeURIComponent(token)} />
          <button type="submit" style={{ color: "var(--bx-accent-text)", fontWeight: 600, fontSize: "0.875rem", background: "none", border: 0, cursor: "pointer" }}>
            Switch account →
          </button>
        </form>
      </div>
    );
  }

  // Accept the invite
  const { error: updateErr } = await supabase
    .from("reservation_collaborators")
    .update({ accepted_at: new Date().toISOString(), user_id: user.id })
    .eq("id", invite.id);

  if (updateErr) {
    return (
      <div className="bx-glass animate-in" style={{ maxWidth: "440px", margin: "4rem auto", padding: "2.5rem 1.75rem", borderRadius: 18, textAlign: "center", width: "calc(100% - 2rem)" }}>
        <div style={{ marginBottom: "1rem", color: "var(--bx-accent-text)" }}><svg width="2.5rem" height="2.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"block",margin:"0 auto"}}><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg></div>
        <h1 style={{ fontSize: "1.625rem", fontWeight: 600, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          We could not accept the invite right now. Please try again or contact the BX team.
        </p>
        <Link href="/" style={{ color: "var(--bx-accent-text)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          Go to dashboard →
        </Link>
      </div>
    );
  }

  // A clear confirmation instead of a silent redirect (nothing read ?collab=)
  const roleLabel = invite.collab_role === "co_owner" ? "co-owner" : "viewer";
  return (
    <div className="bx-glass animate-in" style={{ maxWidth: "440px", margin: "4rem auto", padding: "2.5rem 1.75rem", borderRadius: 18, textAlign: "center", width: "calc(100% - 2rem)" }}>
      <div style={{ marginBottom: "1rem", color: "var(--bx-sage)" }}>
        <svg width="2.5rem" height="2.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "block", margin: "0 auto" }} aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 style={{ fontSize: "1.625rem", fontWeight: 600, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
        You&apos;re in
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
        You&apos;ve joined this reservation as a {roleLabel}. It now appears under My Reservations.
      </p>
      <Link href={`/reservations/${invite.reservation_id}`} className="bx-cta inline-flex items-center justify-center rounded-xl bg-brass px-6 py-3 text-sm font-semibold text-white">
        Open the reservation →
      </Link>
    </div>
  );
}
