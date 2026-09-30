import { NextResponse, after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/return-path";
import { ensureAccountSetup } from "@/lib/account-setup";
import { sendWelcomeEmail } from "@/lib/email";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// POST from /auth/confirm: verify the one-time token on the server, set the
// session cookie, run first sign-in setup, then send the person on.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const token_hash = String(form.get("token_hash") ?? "");
  const rawType = String(form.get("type") ?? "email");
  const type = (TYPES.includes(rawType as EmailOtpType) ? rawType : "email") as EmailOtpType;
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/auth/confirm?type=${type}&error=${error}`, origin), 303);
  if (!token_hash) return back("missing");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error || !data.user) {
    console.warn("[auth/confirm] verify failed:", error?.message);
    return back("expired");
  }

  const setup = await ensureAccountSetup(data.user).catch((e) => {
    console.error("[auth/confirm] setup failed:", e);
    return null;
  });
  const signedIn = data.user;
  if (setup?.isNew && type !== "recovery") {
    after(() => sendWelcomeEmail({ to: signedIn.email ?? "", name: setup.name ?? signedIn.email ?? "" }).catch((e) =>
      console.error("[auth/confirm] welcome email failed:", e)
    ));
  }

  const fallback = type === "recovery" ? "/auth/reset-password" : "/reservations";
  const next = safeNext(String(form.get("next") ?? "")) ?? fallback;
  return NextResponse.redirect(new URL(next, origin), 303);
}
