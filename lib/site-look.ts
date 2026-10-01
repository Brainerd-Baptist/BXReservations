import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cleanTheme, DEFAULT_THEME, type SiteTheme } from "@/lib/site-theme";

/** Site-wide background, set by the Owner (Admin → Settings). */
export interface SiteLook { gridDots: boolean; gridLines: boolean; theme: SiteTheme }
export const DEFAULT_LOOK: SiteLook = { gridDots: true, gridLines: false, theme: DEFAULT_THEME };

async function readSiteLook(): Promise<SiteLook> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return DEFAULT_LOOK;
  try {
    const { data, error } = await createClient(url, key)
      .from("bx_settings").select("key, value").in("key", ["grid_dots", "grid_lines", "site_theme"]);
    if (error) throw error; // don't cache a failed read
    const get = (k: string) => (data ?? []).find((r: { key: string }) => r.key === k)?.value as string | undefined;
    return {
      gridDots: get("grid_dots") ? get("grid_dots") === "on" : DEFAULT_LOOK.gridDots,
      gridLines: get("grid_lines") ? get("grid_lines") === "on" : DEFAULT_LOOK.gridLines,
      theme: (() => { try { return cleanTheme(JSON.parse(get("site_theme") ?? "{}")); } catch { return DEFAULT_THEME; } })(),
    };
  } catch (e) {
    // Let the cache wrapper see the failure (so it isn't stored); pages fall back below.
    throw e;
  }
}

export const SITE_LOOK_TAG = "site-look";

/** Cached: every page reads this, so it no longer costs a database round-trip
 *  per request (C2). Saving in Admin → Settings clears it immediately. */
const cachedSiteLook = unstable_cache(readSiteLook, ["site-look-v2"], { tags: [SITE_LOOK_TAG], revalidate: 600 });
export async function getSiteLook(): Promise<SiteLook> {
  try { return await cachedSiteLook(); } catch { return DEFAULT_LOOK; }
}
