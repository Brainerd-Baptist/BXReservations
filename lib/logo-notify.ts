// Event Map · Phase B — who hears about a logo, and how.
// In-app bell rows (bx_notifications) always; email when Resend is configured.

import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brandedEmailHtml } from "@/lib/email";
import type { ReservationLogoRow } from "@/lib/event-logo";

const FROM = process.env.EMAIL_FROM ?? "BX Reservations <noreply@brainerdhq.app>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jking@brainerdbaptist.org";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx-reservations.vercel.app").replace(/\/$/, "");
const STAFF_ROLES = ["owner", "system_admin", "booking_admin"];

function resend(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

async function staffUserIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("bx_user_roles").select("user_id, role").in("role", STAFF_ROLES);
  return (data ?? []).map((r) => r.user_id as string);
}

const label = (r: ReservationLogoRow) =>
  `${r.event_name ?? "Reservation"}${r.booking_number ? ` (${r.booking_number})` : ""}`;

/** A planner uploaded (or replaced) a logo: tell staff it is waiting. */
export async function notifyLogoUploaded(db: SupabaseClient, r: ReservationLogoRow): Promise<void> {
  const ids = await staffUserIds(db);
  if (ids.length) {
    await db.from("bx_notifications").insert(
      ids.map((user_id) => ({
        user_id,
        reservation_id: r.id,
        type: "logo_review",
        title: "A logo is waiting for review",
        body: `${label(r)} uploaded a logo for its door signs and event map.`,
      }))
    );
  }
  const rs = resend();
  if (!rs) return;
  const html = brandedEmailHtml({
    preheader: `Logo review — ${label(r)}`,
    headline: "A logo is waiting for review.",
    body: `<p style="margin:0 0 16px 0;"><strong>${escapeHtml(label(r))}</strong> uploaded a logo for its door signs and event map.</p><p style="margin:0;">Open the request in the admin panel to approve it or ask for a different file. Nothing shows on the map or signs until it's approved.</p>`,
    ctaText: "Review the logo",
    ctaUrl: `${SITE_URL}/admin/bx-reservations`,
    footnoteHtml: r.booking_number ? `Reference: ${r.booking_number}` : undefined,
  });
  try {
    await rs.emails.send({ from: FROM, to: ADMIN_EMAIL, subject: `Logo review — ${label(r)}`, html });
  } catch (e) {
    console.error("[logo] admin email failed", e);
  }
}

/** Staff decided: tell the planner. */
export async function notifyLogoReviewed(
  db: SupabaseClient,
  r: ReservationLogoRow,
  decision: "approve" | "reject",
  note: string | null
): Promise<void> {
  const approved = decision === "approve";
  const title = approved ? "Your logo is approved" : "We need a different logo file";
  const body = approved
    ? `${label(r)}: your logo now appears on the event map, and door signs will carry it once the reservation is approved.`
    : `${label(r)}: ${note ? note : "please upload a different file for your logo."}`;
  if (r.user_id) {
    await db.from("bx_notifications").insert({ user_id: r.user_id, reservation_id: r.id, type: "logo_review", title, body });
  }
  const rs = resend();
  if (!rs || !r.contact_email) return;
  const name = (r.contact_name ?? "").split(" ")[0] || "there";
  const noteBlock = note
    ? `<p style="background:#f8fafc;border-left:3px solid #00abc9;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;color:#374151;font-size:14px;"><strong>Note from staff:</strong> ${escapeHtml(note)}</p>`
    : "";
  const html = brandedEmailHtml({
    preheader: title,
    headline: approved ? "Your logo is approved." : "We need a different logo file.",
    body: approved
      ? `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 16px 0;">The logo you uploaded for <strong>${escapeHtml(label(r))}</strong> is approved. It now shows in the header of your event map, and your door signs will carry it once the reservation itself is approved.</p>${noteBlock}<p style="margin:0;">You can replace it any time from the reservation page; a replacement goes through review again.</p>`
      : `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 16px 0;">We looked at the logo you uploaded for <strong>${escapeHtml(label(r))}</strong> and need a different file before it can go on the map and door signs.</p>${noteBlock}<p style="margin:0;">Until a new one is approved, your signs use a clean typographic version of your event name — they'll still look sharp.</p>`,
    ctaText: approved ? "Open your event map" : "Upload a different file",
    ctaUrl: approved ? `${SITE_URL}/reservations/${r.id}/event-map` : `${SITE_URL}/reservations/${r.id}#logo`,
    footnoteHtml: r.booking_number ? `Reference: ${r.booking_number}` : undefined,
  });
  try {
    await rs.emails.send({ from: FROM, to: r.contact_email, subject: `${title} — ${label(r)}`, html });
  } catch (e) {
    console.error("[logo] planner email failed", e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
