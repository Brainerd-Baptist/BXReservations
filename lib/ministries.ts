/**
 * BX Reservations — Ministry utilities
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface Ministry {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface MinistryMember {
  id: string;
  ministry_id: string;
  user_id: string;
  is_coordinator: boolean;
  added_at: string;
}

export interface MinistryWithRole extends Ministry {
  is_coordinator: boolean;
}

// ----------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------

/** All ministries the given user belongs to, with their coordinator flag. */
export async function getUserMinistries(
  supabase: SupabaseClient,
  userId: string
): Promise<MinistryWithRole[]> {
  const { data, error } = await supabase
    .from("bx_ministry_members")
    .select("is_coordinator, bx_ministries(id, name, description, created_at)")
    .eq("user_id", userId);

  if (error || !data) return [];

  return data.map((row: { is_coordinator: boolean; bx_ministries: Ministry | Ministry[] }) => {
    const ministry = Array.isArray(row.bx_ministries) ? row.bx_ministries[0] : row.bx_ministries;
    return { ...ministry, is_coordinator: row.is_coordinator };
  });
}

/** All ministries (for dropdowns in admin and booking form). */
export async function getAllMinistries(
  supabase: SupabaseClient
): Promise<Ministry[]> {
  const { data, error } = await supabase
    .from("bx_ministries")
    .select("*")
    .order("name");

  if (error || !data) return [];
  return data as Ministry[];
}

/** Members of a specific ministry, with coordinator flag. */
export async function getMinistryMembers(
  supabase: SupabaseClient,
  ministryId: string
): Promise<(MinistryMember & { email?: string; display_name?: string })[]> {
  const { data, error } = await supabase
    .from("bx_ministry_members")
    .select("*")
    .eq("ministry_id", ministryId)
    .order("added_at");

  if (error || !data) return [];
  return data;
}
