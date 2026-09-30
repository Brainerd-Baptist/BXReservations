import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function statusToKind(status: string): "rental" | "flex" | "declined" {
  if (status === "cancelled") return "declined";
  if (status === "pending" || status === "under_review") return "flex";
  return "rental";
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleData } = await supabase
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role ?? "member";
  const isAdmin = ["owner", "system_admin", "booking_admin"].includes(role);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 14);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 90);

  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("id, booking_number, event_name, status, payload")
    // No cancelled variant belongs on the calendar
    .not("status", "in", "(cancelled,cancelled_by_user,cancelled_by_admin,auto_cancelled)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[admin/calendar] fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events: { date: string; room: string; label: string; kind: "rental" | "flex" | "declined" }[] = [];

  for (const res of reservations ?? []) {
    const payload = (res.payload ?? {}) as Record<string, unknown>;
    const days = (payload.days as Record<string, unknown>[]) ?? [];
    const kind = statusToKind(res.status as string);

    for (const day of days) {
      const dateStr = (day as Record<string, unknown>).date as string;
      if (!dateStr) continue;
      if ((day as Record<string, unknown>).included === false) continue; // day removed from the booking

      const d = new Date(dateStr + "T00:00:00");
      if (d < windowStart || d > windowEnd) continue;

      const rooms = ((day as Record<string, unknown>).rooms as Record<string, unknown>[]) ?? [];
      const roomNames = rooms.map((r) => (r as Record<string, unknown>).roomId as string).filter(Boolean);
      const roomLabel = roomNames.length > 0 ? roomNames.join(", ") : "Space";

      events.push({
        date: dateStr,
        room: roomLabel,
        label: (res.event_name as string) || (res.booking_number as string),
        kind,
      });
    }
  }

  return NextResponse.json({ events });
}
