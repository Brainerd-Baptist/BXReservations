import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect /account — must be signed in
  // Send people back where they were headed after sign-in (audit F12)
  const toLogin = () => {
    const u = new URL("/login", request.url);
    u.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(u);
  };
  if (pathname.startsWith("/account") && !user) {
    return toLogin();
  }

  // Protect /admin/bx-reservations — must be signed in AND admin
  if (pathname.startsWith("/admin/bx-reservations")) {
    if (!user) {
      return toLogin();
    }

    // Check admin role via service role client (bypass RLS)
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    const { data } = await adminClient
      .from("bx_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!["owner", "system_admin", "booking_admin"].includes(data?.role ?? "")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}

// Runs on every page (not API routes or static files) so the sign-in session is
// refreshed wherever people are — booking pages used to sign people out after
// about an hour because only Account and Admin refreshed it (C1).
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|_vercel|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|pdf|woff2?|txt|xml|webmanifest)$).*)"],
};
