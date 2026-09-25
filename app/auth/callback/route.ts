// Where Google sends the browser back after OAuth succeeds.
// Exchanges the one-time `code` param for a real session cookie,
// then redirects to /account. This is the standard @supabase/ssr
// pattern — identical to Personnel and HQ.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/account";

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
      const googleName =
        sessionData.user.user_metadata?.full_name ||
        sessionData.user.user_metadata?.name ||
        null;

      if (googleName) {
        // Use service-role client so we can upsert even before RLS is warmed up
        const adminClient = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { cookies: { getAll: () => [], setAll: () => {} } }
        );

        // Only set display_name if the profile row has no name yet (never overwrite)
        const { data: existing } = await adminClient
          .from("bx_user_profiles")
          .select("display_name")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existing?.display_name) {
          await adminClient
            .from("bx_user_profiles")
            .upsert(
              { user_id: userId, display_name: googleName },
              { onConflict: "user_id", ignoreDuplicates: false }
            );

          // Redirect first-time users with welcome flag so the account page
          // can show a warm onboarding banner.
          return NextResponse.redirect(new URL("/account?welcome=1", requestUrl.origin));
        }
      }
    }
  }

  // Always redirect to origin-relative path — never hardcode a domain.
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
