import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import { SITE_URL } from "@/lib/site";
import { safeNext } from "@/lib/return-path";
import { sendWelcomeEmail } from "@/lib/email";
import { ensureAccountSetup } from "@/lib/account-setup";
import { COOKIE_FLOW } from "@/lib/google-signin";

// Google posts the signed id_token here. We check our one-time state, hand the token to Supabase with our
// nonce, then run the same first-sign-in setup as the original callback (Member role, name, welcome email).
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const [nonce, state, ...rest] = (cookieStore.get(COOKIE_FLOW)?.value || "").split(".");
  let idToken = "", gotState = "";
  try {
    const form = await request.formData();
    idToken = String(form.get("id_token") || "");
    gotState = String(form.get("state") || "");
  } catch { /* handled below */ }

  const done = (path: string) => {
    const res = NextResponse.redirect(`${SITE_URL}${path}`, { status: 303 });
    res.cookies.delete(COOKIE_FLOW);
    return res;
  };
  const fail = (why: string) => {
    console.error("[google-direct]", why);
    return done("/login?error=oauth");
  };

  if (!idToken) return fail("no id_token in form");
  if (!nonce || !state) return fail("flow cookie missing");
  if (gotState !== state) return fail("state mismatch");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce });
  if (error || !data?.user) return fail("signInWithIdToken: " + (error?.message ?? "no user"));

  let explicitNext: string | null = null;
  try { explicitNext = safeNext(decodeURIComponent(rest.join("."))); } catch { /* none */ }
  const next = explicitNext ?? "/account";

  const setup = await ensureAccountSetup(data.user).catch((e) => {
    console.error("[auth/google] setup failed:", e);
    return null;
  });
  if (setup?.isNew) {
    const email = data.user.email ?? "";
    after(() => sendWelcomeEmail({ to: email, name: setup.name ?? email }).catch((err) =>
      console.error("[auth/google] welcome email failed:", err)
    ));
    if (!explicitNext || explicitNext === "/account") return done("/reserve?welcome=1");
  }
  return done(next);
}
