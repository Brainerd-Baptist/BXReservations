import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { brandedEmailHtml, sendEmail } from "@/lib/email";

// ─── Auth ──────────────────────────────────────────────────────────────────────
// Vercel invokes this with: Authorization: Bearer <CRON_SECRET>
// Local dev: set CRON_SECRET in .env.local and call with the header
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev fallback — no secret configured
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
async function getSettings(sb: ReturnType<typeof adminSb>): Promise<Record<string, number>> {
  const defaults: Record<string, number> = {
    auto_cancel_days:        21,
    user_reminder_1_days:    5,
    user_reminder_2_days:    10,
    admin_reminder_days:     3,
    coi_expiry_warning_days: 30,
  };
  const { data } = await sb.from("bx_settings").select("key, value");
  if (!data) return defaults;
  const out = { ...defaults };
  for (const row of data as { key: string; value: string }[]) {
    const n = parseInt(row.value, 10);
    if (!isNaN(n)) out[row.key] = n;
  }
  return out;
}

// ─── Day helpers ──────────────────────────────────────────────────────────────
function daysSince(ts: string): number {
  return (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24);
}

function daysUntil(ts: string): number {
  return (new Date(ts).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

// ─── Email templates ──────────────────────────────────────────────────────────
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jking@brainerdbaptist.org";

function userReminderHtml(opts: {
  name: string;
  bookingNumber: string;
  reservationId: string;
  status: string;
  reminderNum: 1 | 2;
}): string {
  const { name, bookingNumber, reservationId, status, reminderNum } = opts;
  const link = `${SITE}/reservations/${reservationId}`;
  const urgency = reminderNum === 2 ? "This is a second reminder." : "";
  return brandedEmailHtml({
    preheader: `Your reservation ${bookingNumber} needs your attention.`,
    headline: reminderNum === 1 ? "Action Required: Your Reservation Needs a Response" : "Second Reminder: Your Reservation Needs a Response",
    body: `
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">
        We still need a response from you on your reservation <strong>${bookingNumber}</strong>,
        which is currently in <strong>${status}</strong> status. ${urgency}
      </p>
      <p style="margin:0 0 24px">
        Please log in and take the next step — reply to any open questions or upload the
        requested documents — so we can keep your reservation moving forward.
      </p>
      <p style="margin:0 0 24px">
        <a href="${link}" style="display:inline-block;background:#00abc9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
          View My Reservation →
        </a>
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        If we don't hear back, your reservation may be cancelled after a period of inactivity.
        If you have questions, reply to this email.
      </p>
    `,
  });
}

function adminReminderHtml(opts: {
  bookingNumber: string;
  dbId: string;
  contactName: string;
  contactOrg: string;
  submittedAt: string;
  daysSinceSubmit: number;
}): string {
  const { bookingNumber, dbId, contactName, contactOrg, submittedAt, daysSinceSubmit } = opts;
  const link = `${SITE}/admin/bx-reservations?selected=${dbId}`;
  return brandedEmailHtml({
    preheader: `Unreviewed reservation ${bookingNumber} (${Math.round(daysSinceSubmit)} days old)`,
    headline: "Reservation Awaiting Review",
    body: `
      <p style="margin:0 0 16px"><strong>Heads up:</strong> A reservation has been waiting for admin review
        for <strong>${Math.round(daysSinceSubmit)} days</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px">Booking</td><td><strong>${bookingNumber}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Contact</td><td>${contactName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Organization</td><td>${contactOrg || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Submitted</td><td>${submittedAt.split("T")[0]}</td></tr>
      </table>
      <p style="margin:0 0 24px">
        <a href="${link}" style="display:inline-block;background:#00abc9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
          Review Reservation →
        </a>
      </p>
    `,
  });
}

function coiExpiryReminderHtml(opts: {
  orgName: string;
  primaryContactEmail: string;
  expiryDate: string;
  daysUntilExpiry: number;
}): string {
  const { orgName, expiryDate, daysUntilExpiry } = opts;
  return brandedEmailHtml({
    preheader: `COI for ${orgName} expires in ${Math.round(daysUntilExpiry)} days`,
    headline: "Certificate of Insurance Expiring Soon",
    body: `
      <p style="margin:0 0 16px">Hi,</p>
      <p style="margin:0 0 16px">
        This is a reminder that the Certificate of Insurance (COI) on file for
        <strong>${orgName}</strong> will expire on <strong>${expiryDate}</strong>
        — in approximately <strong>${Math.round(daysUntilExpiry)} days</strong>.
      </p>
      <p style="margin:0 0 16px">
        To avoid any disruption to upcoming reservations at Brainerd Baptist Church,
        please provide a renewed COI before the expiration date. The certificate should
        list Brainerd Baptist Church as an additional insured.
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        Please reply to this email or contact the BX office to submit your updated certificate.
      </p>
    `,
  });
}

function autoCancelHtml(opts: {
  name: string;
  bookingNumber: string;
  inactiveDays: number;
}): string {
  const { name, bookingNumber, inactiveDays } = opts;
  return brandedEmailHtml({
    preheader: `Your reservation ${bookingNumber} has been cancelled due to inactivity.`,
    headline: "Your Reservation Has Been Cancelled",
    body: `
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">
        Your reservation <strong>${bookingNumber}</strong> has been cancelled because we didn't receive
        a response after <strong>${inactiveDays} days</strong>.
      </p>
      <p style="margin:0 0 24px">
        We're sorry we weren't able to process your request this time. If you'd still like to book
        space at Brainerd Baptist, please submit a new reservation and we'll be happy to help.
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        If you believe this was an error, please reply to this email or contact the BX office.
      </p>
    `,
  });
}

function postEventFeedbackHtml(opts: {
  name: string;
  eventName: string;
  bookingNumber: string;
}): string {
  const { name, eventName, bookingNumber } = opts;
  return brandedEmailHtml({
    preheader: `Thank you for hosting at Brainerd Baptist — ${eventName}`,
    headline: "Thank You for Hosting at Brainerd Baptist!",
    body: `
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">
        Thank you for hosting <strong>${eventName}</strong> at Brainerd Baptist Church!
        We hope your event went well.
      </p>
      <p style="margin:0 0 24px">
        If you have any feedback about your experience — the space, the process, or anything
        we could do better — we'd love to hear from you. Simply reply to this email.
      </p>
      <p style="margin:0 0 16px">
        We look forward to serving you again in the future. Booking reference: <strong>${bookingNumber}</strong>.
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        — The BX Team, Brainerd Baptist Church
      </p>
    `,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = adminSb();
  const settings = await getSettings(sb);

  const log: string[] = [];
  let errors = 0;

  // ── Fetch all open reservations relevant to automation ─────────────────────
  const { data: reservations, error: resErr } = await sb
    .from("reservations")
    .select("id, booking_number, status, contact_name, contact_email, contact_org, event_name, payload, created_at, organization_id")
    .in("status", ["submitted", "needs_info", "pending_documents", "approved", "confirmed"]);

  if (resErr || !reservations) {
    console.error("[bx-automation] failed to fetch reservations:", resErr);
    return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
  }

  // ── Fetch history entries for these reservations ────────────────────────────
  const resIds = (reservations as { id: string }[]).map(r => r.id);
  const { data: historyRows } = await sb
    .from("reservation_history")
    .select("reservation_id, actor_role, action, created_at, metadata")
    .in("reservation_id", resIds)
    .order("created_at", { ascending: false });

  // Build lookup: reservation_id → history entries
  type HistRow = { reservation_id: string; actor_role: string; action: string; created_at: string; metadata: Record<string, string> | null };
  const histByRes: Record<string, HistRow[]> = {};
  for (const h of (historyRows ?? []) as HistRow[]) {
    if (!histByRes[h.reservation_id]) histByRes[h.reservation_id] = [];
    histByRes[h.reservation_id].push(h);
  }

  // Helper: get the most recent timestamp of last user action (or status-set time)
  function lastUserActivity(resId: string, statusSetAt: string): string {
    const entries = histByRes[resId] ?? [];
    const lastUser = entries.find(e => e.actor_role === "user");
    if (!lastUser) return statusSetAt;
    return lastUser.created_at > statusSetAt ? lastUser.created_at : statusSetAt;
  }

  // Helper: timestamp when status was last set to the given value
  function statusSetAt(resId: string, status: string, fallback: string): string {
    const entries = histByRes[resId] ?? [];
    const match = entries.find(e => e.action === "status_change" && e.metadata?.to_status === status);
    return match ? match.created_at : fallback;
  }

  // Helper: check if a reminder of a given type has already been sent
  function reminderAlreadySent(resId: string, reminderType: string): boolean {
    const entries = histByRes[resId] ?? [];
    return entries.some(e => e.action === "reminder_sent" && e.metadata?.reminder_type === reminderType);
  }

  // Helper: write a history row
  async function writeHistory(resId: string, action: string, metadata: Record<string, string>, note?: string) {
    await sb.from("reservation_history").insert({
      reservation_id: resId,
      actor_role: "system",
      actor_name: "Automation",
      action,
      metadata,
      note: note ?? null,
    });
  }

  // ── 1. Waiting-on-user reminders ───────────────────────────────────────────
  for (const res of reservations as {
    id: string; booking_number: string; status: string;
    contact_name: string; contact_email: string; created_at: string;
  }[]) {
    if (!["needs_info", "pending_documents"].includes(res.status)) continue;

    const setAt = statusSetAt(res.id, res.status, res.created_at);
    const lastActivity = lastUserActivity(res.id, setAt);
    const days = daysSince(lastActivity);

    // First reminder
    if (days >= settings.user_reminder_1_days && days < settings.user_reminder_2_days) {
      if (!reminderAlreadySent(res.id, "user_reminder_1")) {
        try {
          await sendEmail({
            to: res.contact_email,
            subject: `Action needed: reservation ${res.booking_number}`,
            html: userReminderHtml({
              name: res.contact_name,
              bookingNumber: res.booking_number,
              reservationId: res.id,
              status: res.status === "needs_info" ? "Needs Information" : "Pending Documents",
              reminderNum: 1,
            }),
          });
          await writeHistory(res.id, "reminder_sent", { reminder_type: "user_reminder_1" }, "5-day user reminder sent");
          log.push(`reminder_1 → ${res.booking_number}`);
        } catch (e) { errors++; console.error(e); }
      }
    }

    // Second reminder
    if (days >= settings.user_reminder_2_days && days < settings.auto_cancel_days) {
      if (!reminderAlreadySent(res.id, "user_reminder_2")) {
        try {
          await sendEmail({
            to: res.contact_email,
            subject: `Second reminder: reservation ${res.booking_number} needs attention`,
            html: userReminderHtml({
              name: res.contact_name,
              bookingNumber: res.booking_number,
              reservationId: res.id,
              status: res.status === "needs_info" ? "Needs Information" : "Pending Documents",
              reminderNum: 2,
            }),
          });
          await writeHistory(res.id, "reminder_sent", { reminder_type: "user_reminder_2" }, "10-day user reminder sent");
          log.push(`reminder_2 → ${res.booking_number}`);
        } catch (e) { errors++; console.error(e); }
      }
    }
  }

  // ── 2. Waiting-on-admin reminders ─────────────────────────────────────────
  for (const res of reservations as {
    id: string; booking_number: string; status: string;
    contact_name: string; contact_org: string; created_at: string;
  }[]) {
    if (res.status !== "submitted") continue;
    if (reminderAlreadySent(res.id, "admin_reminder")) continue;

    const days = daysSince(res.created_at);
    if (days < settings.admin_reminder_days) continue;

    // Has any admin acted?
    const entries = histByRes[res.id] ?? [];
    const adminActed = entries.some(e => e.actor_role === "admin");
    if (adminActed) continue;

    try {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[BX] Unreviewed reservation: ${res.booking_number} (${Math.round(days)}d old)`,
        html: adminReminderHtml({
          bookingNumber: res.booking_number,
          dbId: res.id,
          contactName: res.contact_name,
          contactOrg: res.contact_org ?? "",
          submittedAt: res.created_at,
          daysSinceSubmit: days,
        }),
      });
      await writeHistory(res.id, "reminder_sent", { reminder_type: "admin_reminder" }, "Admin reminder sent");
      log.push(`admin_reminder → ${res.booking_number}`);
    } catch (e) { errors++; console.error(e); }
  }

  // ── 3. Auto-cancellation ───────────────────────────────────────────────────
  for (const res of reservations as {
    id: string; booking_number: string; status: string;
    contact_name: string; contact_email: string; created_at: string;
  }[]) {
    if (!["needs_info", "pending_documents"].includes(res.status)) continue;

    const setAt = statusSetAt(res.id, res.status, res.created_at);
    const lastActivity = lastUserActivity(res.id, setAt);
    const days = daysSince(lastActivity);
    if (days < settings.auto_cancel_days) continue;
    if (reminderAlreadySent(res.id, "auto_cancelled")) continue;

    try {
      await sb.from("reservations").update({
        status: "auto_cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: `Automatically cancelled after ${settings.auto_cancel_days} days of inactivity`,
        cancelled_by: "Automation",
      }).eq("id", res.id);

      await writeHistory(res.id, "status_change",
        { from_status: res.status, to_status: "auto_cancelled", reminder_type: "auto_cancelled" },
        `Auto-cancelled after ${settings.auto_cancel_days} days of inactivity`
      );

      await sendEmail({
        to: res.contact_email,
        subject: `Your reservation ${res.booking_number} has been cancelled`,
        html: autoCancelHtml({
          name: res.contact_name,
          bookingNumber: res.booking_number,
          inactiveDays: settings.auto_cancel_days,
        }),
      });
      log.push(`auto_cancelled → ${res.booking_number}`);
    } catch (e) { errors++; console.error(e); }
  }

  // ── 4. COI expiry reminders ────────────────────────────────────────────────
  // Find orgs with upcoming confirmed reservations whose COI is expiring soon
  const { data: orgsWithExpiry } = await sb
    .from("bx_organizations")
    .select("id, name, primary_contact_email, coi_expiry_date")
    .not("coi_expiry_date", "is", null)
    .not("primary_contact_email", "is", null);

  for (const org of (orgsWithExpiry ?? []) as {
    id: string; name: string; primary_contact_email: string; coi_expiry_date: string;
  }[]) {
    const days = daysUntil(org.coi_expiry_date);
    if (days < 0 || days > settings.coi_expiry_warning_days) continue;

    // Has this org's COI reminder been sent this cycle?
    const reminderKey = `coi_expiry_${org.id}`;
    // Use a simple check: look for a reminder in the last 25 days in any linked reservation
    const { data: linkedRes } = await sb
      .from("reservations")
      .select("id")
      .eq("organization_id", org.id)
      .in("status", ["confirmed", "approved"])
      .limit(1);

    if (!linkedRes || linkedRes.length === 0) continue;
    const resId = (linkedRes[0] as { id: string }).id;

    if (reminderAlreadySent(resId, reminderKey)) continue;

    try {
      await sendEmail({
        to: org.primary_contact_email,
        subject: `COI renewal needed: expires ${org.coi_expiry_date}`,
        html: coiExpiryReminderHtml({
          orgName: org.name,
          primaryContactEmail: org.primary_contact_email,
          expiryDate: org.coi_expiry_date,
          daysUntilExpiry: days,
        }),
      });
      await writeHistory(resId, "reminder_sent", { reminder_type: reminderKey }, `COI expiry reminder sent to ${org.primary_contact_email}`);
      log.push(`coi_expiry_reminder → ${org.name}`);
    } catch (e) { errors++; console.error(e); }
  }

  // ── 5. Post-event auto-completion ─────────────────────────────────────────
  for (const res of reservations as {
    id: string; booking_number: string; status: string;
    contact_name: string; contact_email: string; event_name: string;
    payload: Record<string, unknown>;
  }[]) {
    if (!["approved", "confirmed"].includes(res.status)) continue;

    // Find the last event date from payload.days
    const days = ((res.payload?.days ?? []) as { date?: string }[]);
    const lastDayStr = days.map(d => d.date ?? "").filter(Boolean).sort().pop();
    if (!lastDayStr) continue;

    const lastDayEnd = new Date(lastDayStr);
    lastDayEnd.setHours(23, 59, 59, 999);
    const hoursElapsed = (Date.now() - lastDayEnd.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < 24) continue;

    if (reminderAlreadySent(res.id, "auto_completed")) continue;

    try {
      await sb.from("reservations").update({ status: "completed" }).eq("id", res.id);
      await writeHistory(res.id, "status_change",
        { from_status: res.status, to_status: "completed", reminder_type: "auto_completed" },
        "Auto-completed: event date has passed"
      );
      await sendEmail({
        to: res.contact_email,
        subject: `Thank you for hosting at Brainerd Baptist — ${res.event_name}`,
        html: postEventFeedbackHtml({
          name: res.contact_name,
          eventName: res.event_name,
          bookingNumber: res.booking_number,
        }),
      });
      log.push(`auto_completed → ${res.booking_number}`);
    } catch (e) { errors++; console.error(e); }
  }

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    actions: log,
    errors,
  });
}
