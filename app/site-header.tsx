import { getUserAndRole } from "@/lib/get-user-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import HeaderShell from "./components/header-shell";

export default async function SiteHeader() {
  const { user, role, profile } = await getUserAndRole();

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user
    ? user.email
        .split("@")[0]
        .split(/[._-]/)
        .map((p: string) => p[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("")
    : "";

  // Fetch saved theme preference if user is logged in
  let savedTheme: string | null = null;
  if (user) {
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
    const { data } = await supabase
      .from("bx_user_prefs")
      .select("theme")
      .eq("user_id", user.id)
      .single();
    savedTheme = data?.theme ?? null;
  }

  return (
    <HeaderShell
      initials={initials}
      role={role}
      hasUser={!!user}
      userId={user?.id}
      email={user?.email}
      displayName={profile?.display_name ?? null}
      savedTheme={savedTheme}
    />
  );
}
