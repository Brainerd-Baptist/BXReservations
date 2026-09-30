import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** A name from the sign-up form or from Google, if there is one. */
export function nameFromAuth(user: Pick<User, "user_metadata">): string | null {
  const m = user.user_metadata ?? {};
  const full = (m.full_name || m.name || [m.given_name, m.family_name].filter(Boolean).join(" ") || "").toString().trim();
  return full || null;
}

/**
 * First sign-in setup, safe to call on every sign-in:
 * - every account gets the Member role unless it already has one
 * - the profile gets the name they signed up with (form or Google), never
 *   overwriting a name they've set
 * Returns isNew = this call created the profile (for the welcome email).
 */
export async function ensureAccountSetup(user: Pick<User, "id" | "email" | "user_metadata">): Promise<{ isNew: boolean; name: string | null }> {
  const db = svc();
  const name = nameFromAuth(user);

  await db
    .from("bx_user_roles")
    .upsert({ user_id: user.id, email: user.email ?? "", role: "member" }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: profile } = await db
    .from("bx_user_profiles")
    .select("user_id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    await db.from("bx_user_profiles").insert({ user_id: user.id, display_name: name });
    return { isNew: true, name };
  }
  if (!profile.display_name && name) {
    await db.from("bx_user_profiles").update({ display_name: name }).eq("user_id", user.id);
  }
  return { isNew: false, name: profile.display_name || name };
}
