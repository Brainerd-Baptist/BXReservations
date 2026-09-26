import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Room / setup labels ───────────────────────────────────────────────────────
const ROOM_LABELS: Record<string, string> = {
  crossing:      "The Crossing",
  crossview:     "CrossView",
  loft:          "The Loft",
  "crosspointe-a": "CrossPointe A",
  "crosspointe-b": "CrossPointe B",
  "crosspointe-c": "CrossPointe C",
  crosstiesA:    "CrossTies A",
  crosstiesB:    "CrossTies B",
  crosstiesC:    "CrossTies C",
  crosstiescafe: "CrossTies Café",
};

const SETUP_LABELS: Record<string, string> = {
  theater:   "Theater",
  classroom: "Classroom",
  banquet:   "Banquet/Rounds",
  reception: "Reception",
  custom:    "Custom",
};

// ─── Status mapping ────────────────────────────────────────────────────────────
// DB statuses:  pending | under_review | pending_insurance | approved | rejected | cancelled
// Admin labels: Requested | Proposal Sent | Deposit Received | Confirmed | Declined

// Allowed DB statuses (from check constraint):
//   pending_insurance | under_review | approved | confirmed | completed | cancelled
const DB_TO_ADMIN: Record<string, string> = {
  pending_insurance: "Requested",       // new submission
  under_review:      "Proposal Sent",
  approved:          "Deposit Received",
  confirmed:         "Confirmed",
  completed:         "Confirmed",
  cancelled:         "Declined",
};

const ADMIN_TO_DB: Record<string, string> = {
  "Requested":        "pending_insurance",
  "Proposal Sent":    "under_review",
  "Deposit Received": "approved",
  "Confirmed":        "confirmed",
  "Declined":         "cancelled",
};

// ─── GET — list all reservations ──────────────────────────────────────────────
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("reservations")
    .select("id, booking_number, status, event_name, contact_name, contact_email, contact_org, is_non_profit, created_at, payload")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/reservations] fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests = (data ?? []).map((row: any) => {
    const payload   = (row.payload ?? {}) as Record<string, unknown>;
    const days      = (payload.days as Record<string, unknown>[]) ?? [];
    const firstDay  = (days[0] ?? {}) as Record<string, unknown>;
    const rooms     = (firstDay.rooms as Record<string, unknown>[]) ?? [];
    const firstRoom = (rooms[0] ?? {}) as Record<string, unknown>;
    const roomId    = (firstRoom.roomId as string) ?? "";
    const setup     = (firstRoom.setup  as string) ?? "";

    return {
      id:         row.booking_number as string,
      dbId:       row.id as string,
      name:       (row.contact_name as string) || (row.contact_email as string),
      org:        (row.contact_org  as string) ?? "",
      email:      row.contact_email as string,
      room:       ROOM_LABELS[roomId] ?? roomId,
      date:       (firstDay.date as string) ?? "",
      event:      (row.event_name  as string) ?? "",
      guests:     (firstDay.headcount as number) ?? 0,
      setup:      SETUP_LABELS[setup] ?? setup,
      estimate:   0,
      status:     DB_TO_ADMIN[row.status as string] ?? "Requested",
      submitted:  (row.created_at as string).split("T")[0],
      nonProfit:  (row.is_non_profit as boolean) ?? false,
      avNeeded:   false,
      tablecloths:0,
      flexible:   false,
    };
  });

  return NextResponse.json(requests);
}

// ─── PATCH — update status ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { dbId, status } = (await req.json()) as { dbId: string; status: string };

  if (!dbId || !status) {
    return NextResponse.json({ error: "Missing dbId or status" }, { status: 400 });
  }

  const dbStatus = ADMIN_TO_DB[status];
  if (!dbStatus) {
    return NextResponse.json({ error: `Unknown admin status: ${status}` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .from("reservations")
    .update({ status: dbStatus, updated_at: new Date().toISOString() })
    .eq("id", dbId);

  if (error) {
    console.error("[admin/reservations] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dbStatus });
}
