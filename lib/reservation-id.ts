import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A URL may carry a reservation's id or its booking number (BX-1234). Returns
 * the id, looked up safely (no raw text inside a database filter string).
 * Returns the input unchanged when nothing matches, so callers 404 as before.
 */
export async function resolveReservationId(db: SupabaseClient, idOrNumber: string): Promise<string> {
  if (UUID.test(idOrNumber)) return idOrNumber;
  const { data } = await db.from("reservations").select("id").eq("booking_number", idOrNumber).maybeSingle();
  return (data?.id as string | undefined) ?? "00000000-0000-0000-0000-000000000000";
}

export const isUuid = (s: string) => UUID.test(s);

/** Escape % _ \ so an email is matched literally by ilike (case-insensitive equals). */
export const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
