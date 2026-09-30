import { createClient } from "@supabase/supabase-js";

/** Site-wide background grid, set by the Owner (Admin → Settings). */
export interface SiteLook { gridDots: boolean; gridLines: boolean }
export const DEFAULT_LOOK: SiteLook = { gridDots: true, gridLines: false };

export async function getSiteLook(): Promise<SiteLook> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return DEFAULT_LOOK;
  try {
    const { data } = await createClient(url, key)
      .from("bx_settings").select("key, value").in("key", ["grid_dots", "grid_lines"]);
    const get = (k: string) => (data ?? []).find((r: { key: string }) => r.key === k)?.value as string | undefined;
    return {
      gridDots: get("grid_dots") ? get("grid_dots") === "on" : DEFAULT_LOOK.gridDots,
      gridLines: get("grid_lines") ? get("grid_lines") === "on" : DEFAULT_LOOK.gridLines,
    };
  } catch {
    return DEFAULT_LOOK;
  }
}
