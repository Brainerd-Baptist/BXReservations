// Server-only — never import in "use client" files.
// Uses the service role key to read bx_user_roles, bypassing RLS.
// Returns 'admin' | 'user' | null (null = not in the roles table / not signed in)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getUserAndRole(): Promise<{
  user: { id: string; email: string } | null;
  role: "admin" | "user" | null;
}> {
  const cookieStore = await cookies();

  // Regular anon client to get the session
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };

  // Service role client to read the roles table (bypasses RLS)
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

  return {
    user: { id: user.id, email: user.email ?? "" },
    role: (data?.role as "admin" | "user") ?? "user",
  };
}
