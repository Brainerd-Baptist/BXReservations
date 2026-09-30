import { NextResponse } from "next/server";
import { safeNext, loginHref } from "@/lib/return-path";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SITE_URL } from "@/lib/site";

export async function POST(request: Request) {
  // Optional `next` (e.g. "Switch account" on an invite): sign out, then go to
  // sign-in with that destination preserved.
  let next: string | null = null;
  try {
    const form = await request.formData();
    next = safeNext(form.get("next")?.toString());
  } catch { /* no body */ }
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.signOut();

  const base = SITE_URL;
  return NextResponse.redirect(new URL(next ? loginHref(next) : "/", base), {
    status: 303,
  });
}
