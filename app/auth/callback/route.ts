// Where Google sends the browser back after OAuth succeeds.
// Exchanges the one-time `code` param for a real session cookie,
// then redirects to /account. This is the standard @supabase/ssr
// pattern — identical to Personnel and HQ.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/reservations";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code);

    // ── First-run profile seeding ──────────────────────────────────────────
    // If this is a brand-new Google sign-in and the user has no profile yet,
    // pre-seed their display name from Google's identity data. This makes the
    // reservation form feel immediately personal without requiring a separate
    // profile-completion step.
    if (sessionData?.user) {
      const userId = sessionData.user.id;
      const userEmail = sessionData.user.email ?? "";
      const googleName =
        sessionData.user.user_metadata?.full_name ||
        sessionData.user.user_metadata?.name ||
        null;

      // Use service-role client so we can upsert even before RLS is warmed up
      const adminClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { getAll: () => [], setAll: () => {} } }
      );

      // ── Default role seeding ─────────────────────────────────────────────
      // Every new Google user gets the "member" role. ignoreDuplicates ensures
      // we never overwrite a role that an admin has already assigned.
      await adminClient
        .from("bx_user_roles")
        .upsert(
          { user_id: userId, email: userEmail, role: "member" },
          { onConflict: "user_id", ignoreDuplicates: true }
        );

      // ── First-run profile seeding ────────────────────────────────────────
      // ── Detect first-time user (no profile yet) ─────────────────────────────
      const { data: existing } = await adminClient
        .from("bx_user_profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();

      const isNewUser = !existing?.display_name;

      if (googleName) {
        // Only set display_name if the profile row has no name yet (never overwrite)
        if (isNewUser) {
          await adminClient
            .from("bx_user_profiles")
            .upsert(
              { user_id: userId, display_name: googleName },
              { onConflict: "user_id", ignoreDuplicates: false }
            );

          // Send welcome email for first-time Google sign-ups (fire-and-forget)
          sendWelcomeEmail({ to: userEmail, name: googleName }).catch((err) =>
            console.error("[auth/callback] welcome email failed:", err)
          );

          // Redirect first-time users with welcome flag so the account page
          // can show a warm onboarding banner.
          return NextResponse.redirect(new URL("/reserve?welcome=1", requestUrl.origin));
        }
      } else if (isNewUser) {
        // Email/password sign-up — no googleName but also no profile yet.
        // Seed the profile from Supabase auth metadata (set during sign-up form).
        const authName =
          sessionData.user.user_metadata?.full_name ||
          sessionData.user.user_metadata?.name ||
          "";
        if (authName) {
          await adminClient
            .from("bx_user_profiles")
            .upsert(
              { user_id: userId, display_name: authName },
              { onConflict: "user_id", ignoreDuplicates: true }
            );
        }
        // Send welcome email for first-time email sign-ups (fire-and-forget)
        sendWelcomeEmail({ to: userEmail, name: authName || userEmail }).catch(
          (err) => console.error("[auth/callback] welcome email failed:", err)
        );
      }
    }
  }

  // Always redirect to origin-relative path — never hardcode a domain.
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
