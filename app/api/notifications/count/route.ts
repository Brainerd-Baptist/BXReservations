import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, isStaffRole } from "@/lib/event-map";

/**
 * The red badge = unread notifications + invitations waiting on you — the
 * same things the bell's list shows, so reading them clears it.
 * Staff also get `awaitingReview` (requests not yet reviewed) for a link in
 * the list; it isn't added to the badge, because it only clears when the
 * request is handled, not when it's read.
 */
export async function GET() {
  const noStore = { headers: { "Cache-Control": "no-store, max-age=0" } };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ count: 0, unread: 0, invites: 0, awaitingReview: 0, staff: false }, noStore);

    const db = adminClient();
    const email = (user.email ?? "").toLowerCase();
    const [{ data: roleRow }, unread, invites] = await Promise.all([
      db.from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      db.from("bx_notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
      email
        ? db.from("reservation_collaborators").select("id", { count: "exact", head: true }).eq("invited_email", email).is("accepted_at", null)
        : Promise.resolve({ count: 0 }),
    ]);
    const staff = isStaffRole(roleRow?.role as string | undefined);
    let awaitingReview = 0;
    if (staff) {
      const { count } = await db.from("reservations").select("id", { count: "exact", head: true }).eq("status", "pending");
      awaitingReview = count ?? 0;
    }
    const u = unread.count ?? 0, i = invites.count ?? 0;
    return NextResponse.json({ count: u + i, unread: u, invites: i, awaitingReview, staff }, noStore);
  } catch (err) {
    console.error("[notifications/count]", err);
    return NextResponse.json({ count: 0, unread: 0, invites: 0, awaitingReview: 0, staff: false }, noStore);
  }
}
