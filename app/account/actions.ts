"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function saveProfile(formData: FormData) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const display_name = (formData.get("display_name") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const organization = (formData.get("organization") as string)?.trim() || null;

  const { error } = await supabase.from("bx_user_profiles").upsert(
    { user_id: user.id, display_name, phone, organization },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { success: true };
}
