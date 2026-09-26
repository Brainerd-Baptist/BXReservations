// supabase/functions/booking-reminder/index.ts
// Runs on a pg_cron schedule (hourly).
// Finds confirmed reservations whose first event day is 44–52 hours from now
// and sends a reminder email — once per reservation (idempotent via the
// `reminder_sent_at` column; add that column if it doesn't exist).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://bx.brainerdhq.app";
const FROM     = "BX Reservations <reservations@brainerdhq.app>";

Deno.serve(async (_req) => {
  // Auth is handled by Supabase's verify_jwt gate (anon JWT from pg_cron passes).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

  // Window: 44–52 hours from now (catches hourly runs reliably)
  const now       = new Date();
  const windowLo  = new Date(now.getTime() + 44 * 60 * 60 * 1000);
  const windowHi  = new Date(now.getTime() + 52 * 60 * 60 * 1000);

  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, payload, reminder_sent_at")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null);

  if (error) {
    console.error("[booking-reminder] fetch error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const res of reservations ?? []) {
    const payload  = (res.payload ?? {}) as Record<string, unknown>;
    const days     = (payload.days  as Record<string, unknown>[]) ?? [];
    const firstDay = (days[0] ?? {}) as Record<string, unknown>;
    const dateStr  = (firstDay.date as string) ?? ""; // "YYYY-MM-DD"
    if (!dateStr) { skipped.push(res.booking_number); continue; }

    // Parse first-day date — assume times are US/Central but compare in UTC range
    const eventDate = new Date(`${dateStr}T00:00:00-05:00`); // local midnight
    if (eventDate < windowLo || eventDate > windowHi) {
      skipped.push(res.booking_number); continue;
    }

    // Extract time slots from the first room block of the first day
    const rooms     = (firstDay.rooms as Record<string, unknown>[]) ?? [];
    const firstRoom = (rooms[0] ?? {}) as Record<string, unknown>;
    const startTime = (firstRoom.startTime as string) ?? "—";
    const endTime   = (firstRoom.endTime   as string) ?? "—";
    const roomNames = rooms.map((r) => (r.roomId as string) ?? "Room").join(", ");
    const headcount = (firstDay.headcount as number) ?? 0;

    const formattedDate = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    // Build the reminder email inline (mirrors sendBookingReminder from lib/email.ts)
    const html = reminderHtml({
      name:      (res.contact_name as string) || (res.contact_email as string),
      eventName: res.event_name as string,
      bookingNumber: res.booking_number as string,
      reservationId: res.id as string,
      firstDate:     formattedDate,
      startTime,
      endTime,
      rooms:         roomNames ? [roomNames] : [],
      headcount,
    });

    try {
      await resend.emails.send({
        from: FROM,
        to:      res.contact_email as string,
        subject: `Reminder: "${res.event_name as string}" is in 48 hours — ${res.booking_number as string}`,
        html,
      });

      // Mark as reminded so we don't re-send
      await supabase
        .from("reservations")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", res.id);

      sent.push(res.booking_number as string);
    } catch (err) {
      console.error(`[booking-reminder] send failed for ${res.booking_number as string}:`, err);
      skipped.push(res.booking_number as string);
    }
  }

  console.log(`[booking-reminder] sent=${sent.length} skipped=${skipped.length}`);
  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ─── Minimal reminder email builder (duplicated from lib/email.ts for Edge) ──
function reminderHtml(opts: {
  name: string; eventName: string; bookingNumber: string; reservationId: string;
  firstDate: string; startTime: string; endTime: string; rooms: string[]; headcount: number;
}): string {
  const { name, eventName, bookingNumber, reservationId, firstDate, startTime, endTime, rooms, headcount } = opts;
  const ctaUrl = `${SITE_URL}/reservations/${reservationId}`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:ui-sans-serif,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#00205b;padding:28px 32px;">
          <p style="margin:0;color:#c8a84b;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">BX · Brainerd Crossing</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">Your booking is coming up.</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;">Hi ${name},</p>
          <p style="margin:0 0 16px;">This is a reminder that your space reservation at Brainerd Baptist Church is <strong>48 hours away</strong>. Here's a quick summary:</p>
          <table border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;width:38%;">Booking #</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#00205b;font-size:14px;font-weight:700;">${bookingNumber}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Event</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${eventName}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Date</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${firstDate}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Time</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${startTime} – ${endTime}</td></tr>
            ${rooms.length ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Space(s)</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${rooms.join(", ")}</td></tr>` : ""}
            <tr><td style="padding:10px 0;font-weight:600;color:#374151;font-size:14px;">Headcount</td><td style="padding:10px 0;color:#374151;font-size:14px;">${headcount} attendees</td></tr>
          </table>
          <p style="margin:16px 0 24px;">If you have any questions or need to make last-minute changes, please contact the church office as soon as possible.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#00205b;">
            <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:700;font-size:15px;text-decoration:none;">View Your Booking</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f8f8f6;padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#6b7280;">The BX Team · Brainerd Baptist Church · Reference: ${bookingNumber}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
