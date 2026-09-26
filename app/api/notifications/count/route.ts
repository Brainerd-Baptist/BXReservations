import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ count: 0 });
    }

    // Resolve BX role
    const { data: roleData } = await supabase
      .from("bx_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleData?.role ?? "member";
    const isAdmin = ["owner", "system_admin", "booking_admin"].includes(role);

    let count = 0;

    // ── Unread bx_notifications for this user (covers status updates, reminders, etc.) ──
    const { count: bellCount } = await supabase
      .from("bx_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    count += bellCount ?? 0;

    if (isAdmin) {
      // Admins: also count reservations awaiting staff review (legacy signal)
      const { count: pendingCount } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_insurance");

      count += pendingCount ?? 0;
    } else {
      // Regular users: also count pending collaboration invites
      const { count: inviteCount } = await supabase
        .from("reservation_collaborators")
        .select("id", { count: "exact", head: true })
        .eq("invited_email", user.email?.toLowerCase() ?? "")
        .is("accepted_at", null);

      count += inviteCount ?? 0;
    }

    return NextResponse.json({ count }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[notifications/count]", err);
    return NextResponse.json({ count: 0 });
  }
}
