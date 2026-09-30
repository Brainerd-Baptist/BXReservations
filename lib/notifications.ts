import type { SupabaseClient } from "@supabase/supabase-js";

/** Tell the bell in the header to re-check (same tab). */
export const NOTIFICATIONS_CHANGED = "bx:notifications-changed";

/**
 * Mark this person's notifications about one booking as read — called when
 * they open that booking any way (bell, email link, list, admin panel), so the
 * red badge matches what they've actually seen.
 */
export async function markReservationNotificationsRead(db: SupabaseClient, userId: string, reservationId: string) {
  await db
    .from("bx_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("reservation_id", reservationId)
    .is("read_at", null);
}
