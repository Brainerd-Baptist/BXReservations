import type { SupabaseClient } from "@supabase/supabase-js";
import { sendCancellationNotice } from "@/lib/email";
import { STAFF_ROLES } from "@/lib/event-map";

/** "Wed, Oct 1, 2026, 3:42 PM ET" */
export function venueStamp(d = new Date()): string {
  return `${d.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} ET`;
}

/**
 * Tell everyone on a booking — organizer, co-organizers, viewers and BX staff —
 * who cancelled it, when, and why (C4). In-app for everyone with an account,
 * email to the organizer and everyone invited. Never throws.
 */
export async function notifyCancellation(db: SupabaseClient, opts: {
  reservation: { id: string; booking_number: string | null; event_name: string | null; contact_email: string | null; user_id: string | null };
  who: string;
  reason: string;
  actorUserId: string | null;
  /** false when the organizer already gets the status email (staff cancel) */
  emailOrganizer?: boolean;
}): Promise<void> {
  const r = opts.reservation;
  const when = venueStamp();
  const ref = r.booking_number ?? r.id.slice(0, 8);
  const event = r.event_name ?? "a booking";
  try {
    const [{ data: collabs }, { data: staff }] = await Promise.all([
      db.from("reservation_collaborators").select("user_id, invited_email, accepted_at").eq("reservation_id", r.id),
      db.from("bx_user_roles").select("user_id").in("role", STAFF_ROLES as unknown as string[]),
    ]);
    const userIds = new Set<string>();
    if (r.user_id) userIds.add(r.user_id);
    for (const c of collabs ?? []) if (c.user_id && c.accepted_at) userIds.add(c.user_id as string);
    for (const s of staff ?? []) userIds.add(s.user_id as string);
    if (opts.actorUserId) userIds.delete(opts.actorUserId);
    if (userIds.size) {
      await db.from("bx_notifications").insert([...userIds].map((user_id) => ({
        user_id, reservation_id: r.id, type: "status_update",
        title: `Cancelled: ${event}`,
        body: `${opts.who} cancelled ${event} (${ref}) on ${when}. Reason: ${opts.reason}`,
      })));
    }
    const emails = new Set<string>();
    for (const c of collabs ?? []) if (c.invited_email) emails.add(String(c.invited_email).toLowerCase());
    if (r.contact_email) {
      if (opts.emailOrganizer === false) emails.delete(r.contact_email.toLowerCase());
      else emails.add(r.contact_email.toLowerCase());
    }
    await Promise.allSettled([...emails].map((to) => sendCancellationNotice({
      to, bookingNumber: ref, reservationId: r.id, eventName: event, who: opts.who, when, reason: opts.reason,
    })));
  } catch (e) {
    console.error("[cancel] notify failed:", (e as Error).message);
  }
}
