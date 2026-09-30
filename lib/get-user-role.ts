import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { BxRole } from "@/lib/roles";
import { ensureAccountSetup, nameFromAuth } from "@/lib/account-setup";

export type { BxRole };

export interface UserProfile {
  display_name: string | null;
  phone: string | null;
  organization: string | null;
}

export async function getUserAndRole(): Promise<{
  user: { id: string; email: string } | null;
  role: BxRole | null;
  profile: UserProfile | null;
}> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server components can't write cookies — middleware handles refresh
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null, profile: null };

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const [roleResult, profileResult] = await Promise.all([
    adminClient
      .from("bx_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single(),
    adminClient
      .from("bx_user_profiles")
      .select("display_name, phone, organization")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Safety net: an account that somehow skipped first sign-in setup (older
  // accounts, a link opened in another browser) is set up now.
  if (!roleResult.data?.role || !profileResult.data || (!profileResult.data.display_name && nameFromAuth(user))) {
    await ensureAccountSetup(user).catch((e) => console.error("[get-user-role] setup failed:", e));
    return {
      user: { id: user.id, email: user.email ?? "" },
      role: (roleResult.data?.role as BxRole) ?? "member",
      profile: {
        display_name: profileResult.data?.display_name || nameFromAuth(user),
        phone: profileResult.data?.phone ?? null,
        organization: profileResult.data?.organization ?? null,
      },
    };
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    role: (roleResult.data?.role as BxRole) ?? null,
    profile: profileResult.data ?? null,
  };
}
