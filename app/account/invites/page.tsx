import { redirect } from "next/navigation";
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
      <main style={{ maxWidth: "480px", margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔗</p>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Invalid invite link
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          This link is missing the invite token. Make sure you copied the full link from the email.
        </p>
        <Link href="/" style={{ color: "var(--bx-brass)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          Go to dashboard →
        </Link>
      </main>
    );
  }

  // Auth guard
  const { user } = await getUserAndRole();
  if (!user) {
    redirect("/login?redirect=/account/invites?token=" + encodeURIComponent(token));
  }

  // Set up server supabase
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

  // Look up the invite by token
  const { data: invite, error: lookupErr } = await supabase
    .from("reservation_collaborators")
    .select("id, reservation_id, accepted_at, collab_role, invited_email")
    .eq("invite_token", token)
    .single();

  if (lookupErr || !invite) {
    return (
      <main style={{ maxWidth: "480px", margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>❌</p>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Invite not found
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          This invite link may have expired or already been used. Ask the reservation owner to send a new invite.
        </p>
        <Link href="/" style={{ color: "var(--bx-brass)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          Go to dashboard →
        </Link>
      </main>
    );
  }

  // Already accepted
  if (invite.accepted_at) {
    redirect("/?collab=already&res=" + invite.reservation_id);
  }

  // Verify email matches
  if (invite.invited_email && invite.invited_email !== user.email?.toLowerCase()) {
    return (
      <main style={{ maxWidth: "480px", margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</p>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Wrong account
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          This invite was sent to <strong>{invite.invited_email}</strong>.
          You are signed in as <strong>{user.email}</strong>.<br /><br />
          Sign in with the correct account to accept this invite.
        </p>
        <Link href="/login" style={{ color: "var(--bx-brass)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          Switch account →
        </Link>
      </main>
    );
  }

  // Accept the invite
  const { error: updateErr } = await supabase
    .from("reservation_collaborators")
    .update({ accepted_at: new Date().toISOString(), user_id: user.id })
    .eq("id", invite.id);

  if (updateErr) {
    return (
      <main style={{ maxWidth: "480px", margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</p>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--bx-parchment)", marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginBottom: "1.5rem" }}>
          We could not accept the invite right now. Please try again or contact the BX team.
        </p>
        <Link href="/" style={{ color: "var(--bx-brass)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          Go to dashboard →
        </Link>
      </main>
    );
  }

  redirect("/account?collab=accepted&res=" + invite.reservation_id);
}
