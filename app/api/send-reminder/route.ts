import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBookingReminder } from "@/lib/email";
import { ROOMS } from "@/lib/rooms";

// ─── Auth: shared secret between Edge Function and this route ─────────────────
const REMINDER_SECRET = process.env.REMINDER_WEBHOOK_SECRET ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function roomLabel(roomId: string): string {
  return ROOMS.find((r) => r.id === roomId)?.name ?? roomId;
}

function formatTime(hhmm: string): string {
  // "08:00" → "8:00 AM", "22:00" → "10:00 PM"
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr: string): string {
  // "2026-09-28" → "Monday, September 28, 2026"
  const d = new Date(`${dateStr}T12:00:00`); // noon to avoid TZ edge cases
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Verify secret
  const auth = req.headers.get("x-reminder-secret");
  if (!REMINDER_SECRET || auth !== REMINDER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { reservationId } = body as { reservationId?: string };
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch reservation
  const { data: res, error } = await supabase
    .from("reservations")
    .select("id, booking_number, contact_name, contact_email, event_name, payload, status, reminder_sent_at, user_id")
    .eq("id", reservationId)
    .single();

  if (error || !res) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Skip if already sent
  if (res.reminder_sent_at) {
    return NextResponse.json({ skipped: "already_sent" });
  }

  // Check user notification prefs (only if there's a linked user account)
  if (res.user_id) {
    const { data: prefs } = await supabase
      .from("bx_user_prefs")
      .select("notify_reservation_reminder")
      .eq("user_id", res.user_id)
      .single();

    if (prefs && prefs.notify_reservation_reminder === false) {
      return NextResponse.json({ skipped: "user_opted_out" });
    }
  }

  // Parse payload
  const payload = res.payload as {
    days: Array<{
      date: string;
      customStart: string;
      customEnd: string;
      headcount: number;
      rooms: Array<{ roomId: string }>;
    }>;
  };

  const firstDay = payload?.days?.[0];
  if (!firstDay) {
    return NextResponse.json({ error: "No days in payload" }, { status: 422 });
  }

  const rooms = firstDay.rooms.map((r) => roomLabel(r.roomId));

  // Send email
  await sendBookingReminder({
    to:            res.contact_email,
    name:          res.contact_name,
    bookingNumber: res.booking_number,
    eventName:     res.event_name,
    firstDate:     formatDate(firstDay.date),
    startTime:     formatTime(firstDay.customStart),
    endTime:       formatTime(firstDay.customEnd),
    rooms,
    headcount:     firstDay.headcount,
  });

  // Stamp reminder_sent_at
  await supabase
    .from("reservations")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", res.id);

  return NextResponse.json({ sent: true, to: res.contact_email, booking: res.booking_number });
}
