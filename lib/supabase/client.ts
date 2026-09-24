// Browser-side Supabase client — use in "use client" components only.
// NEXT_PUBLIC_* vars are safe to expose; security boundary is Postgres RLS.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
