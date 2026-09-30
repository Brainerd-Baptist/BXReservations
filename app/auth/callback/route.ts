// Where Google sends the browser back after OAuth succeeds.
// Exchanges the one-time `code` param for a real session cookie,
// then redirects to /account. This is the standard @supabase/ssr
// pattern — identical to Personnel and HQ.
import { safeNext } from "@/lib/return-path";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";
import { ensureAccountSetup } from "@/lib/account-setup";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Only same-site paths; an explicit destination (an invite, a reservation)
  // wins over the first-run welcome page (audit F12).
  const explicitNext = safeNext(requestUrl.searchParams.get("next"));
  const next = explicitNext ?? "/reservations";

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

    // First sign-in setup: Member role + the name from Google or the sign-up
    // form (lib/account-setup.ts — the same step the email links run).
    if (sessionData?.user) {
      const setup = await ensureAccountSetup(sessionData.user).catch((e) => {
        console.error("[auth/callback] setup failed:", e);
        return null;
      });
      if (setup?.isNew) {
        const email = sessionData.user.email ?? "";
        after(() => sendWelcomeEmail({ to: email, name: setup.name ?? email }).catch((err) =>
          console.error("[auth/callback] welcome email failed:", err)
        ));
        if (!explicitNext || explicitNext === "/account") {
          return NextResponse.redirect(new URL("/reserve?welcome=1", requestUrl.origin));
        }
      }
    }
  }

  // Always redirect to origin-relative path — never hardcode a domain.
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
