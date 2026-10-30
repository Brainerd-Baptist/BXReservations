import { Resend } from "resend";
import { SITE_URL, SUPPORT_EMAIL, SUPPORT_PHONE, ADMIN_EMAIL } from "@/lib/site";

// Lazy-initialize so the build succeeds even before RESEND_API_KEY is set in Vercel
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/** Send through Resend and throw on failure — Resend reports errors in the
 *  result instead of throwing, so failures used to be logged as "sent OK". */
async function deliver(payload: Parameters<ReturnType<typeof getResend>["emails"]["send"]>[0]) {
  // Replies go to the BX inbox, not the no-reply sender (also helps deliverability)
  const { error } = await getResend().emails.send({ replyTo: SUPPORT_EMAIL, ...payload } as typeof payload);
  if (error) throw new Error(`Resend: ${error.name ?? "error"} — ${error.message}`);
}

/** Escape text people typed (names, event names, notes) before it goes into
 *  email HTML — otherwise anyone could put links or markup into a church email. */
export const escHtml = (t: unknown) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
/** Escaped, with line breaks kept. */
export const escMultiline = (t: unknown) => escHtml(t).replace(/\r?\n/g, "<br>");

const FROM        = process.env.EMAIL_FROM ?? "BX Reservations <noreply@brainerdhq.app>";

// ─── Design tokens ────────────────────────────────────────────────────────────
// Update these if Brainerd's brand colors ever change.
const NAVY  = "#00205b";   // headlines, bold emphasis, secondary button text
const TEAL  = "#00abc9";   // primary button background, inline links
const WHITE = "#ffffff";   // primary button text

const FONT     = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
// Hosted on this site (it used to load from another project's site) — C2
const LOGO_URL = `${SITE_URL}/email/brainerd-logo.png`;

// Footer contact shown in the security line
const SENDER_NAME   = "The BX Team";
const ORG_NAME      = "Brainerd Baptist Church";

// ─── Reusable secondary outline button (for use inside footnoteHtml) ─────────
// Matches the template's invite-email.js secondary button pattern exactly.
export function pillButtonHtml(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px auto;">
      <tr>
        <td style="background-color:${WHITE}; border:1.5px solid ${NAVY}; border-radius:8px;">
          <a href="${url}" style="display:inline-block; color:${NAVY}; font-family:${FONT}; font-size:14px; font-weight:700; text-decoration:none; padding:11px 24px;">
            <span style="color:${NAVY}; text-decoration:none;">${text} &rarr;</span>
          </a>
        </td>
      </tr>
    </table>`;
}

// ─── Core HTML builder ────────────────────────────────────────────────────────
//
// Design principles (same as template):
//   - ONE font stack on every element
//   - Table-based layout + inline styles only (Outlook / mobile safe)
//   - Brand color used sparingly: headline + primary button only
//   - "Bulletproof button": background-color on <td>, not <a>, so it works in Gmail
//   - <span> inside <a> re-asserts color + text-decoration so Gmail mobile can't override
//   - Personal signature footer, not legal boilerplate
//
// @param preheader    — Hidden preview text (first ~90 chars shown in inbox)
// @param headline     — h1 at the top of the email
// @param body         — Middle content (inline-styled HTML paragraphs, tables, etc.)
// @param ctaText      — Primary button label
// @param ctaUrl       — Primary button URL
// @param footnoteHtml — Optional HTML below the button (secondary buttons, tips, etc.)
//                       Defaults to a "bookmark this link" tip. Pass null to omit entirely.

export function brandedEmailHtml(opts: {
  preheader?:    string;
  headline:      string;
  body:          string;
  ctaText?:      string;
  ctaUrl?:       string;
  footnoteHtml?: string | null;
}): string {
  const { preheader = "", headline, body, ctaText, ctaUrl, footnoteHtml } = opts;

  const ctaBlock = ctaText && ctaUrl ? `
        <!-- PRIMARY CTA BUTTON
             "Bulletproof" centered button pattern (from template):
             - Inner auto-width table centered with align="center" + margin:0 auto
             - Background color + border-radius on the <td>, NOT the <a>
             - <span> inside <a> re-asserts color + text-decoration so Gmail
               mobile can't override them (Gmail strips styles directly on <a>)
             Works correctly in Gmail mobile, Apple Mail, and Outlook. -->
        <tr>
          <td style="padding:0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 10px auto;">
              <tr>
                <td class="bx-cta-cell" style="background-color:${TEAL}; border-radius:8px;">
                  <a class="bx-cta" href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
                    style="display:inline-block; color:${WHITE}; font-family:${FONT}; font-size:15px; font-weight:700; text-decoration:none; padding:13px 28px;">
                    <span class="bx-cta" style="color:${WHITE}; text-decoration:none;">${ctaText}</span>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : "";

  // footnoteHtml: null = omit block entirely; undefined = show default tip
  const footnoteBlock = footnoteHtml === null ? "" : `
        <!-- FOOTNOTE (secondary button, tips, extra context) -->
        <tr>
          <td style="padding:20px 40px 0 40px; font-family:${FONT}; font-size:13px; line-height:1.6; color:#6b7280;">
            ${
              footnoteHtml !== undefined
                ? footnoteHtml
                : ctaUrl
                  ? `<p style="margin:0;">Tip: bookmark <a href="${ctaUrl}" style="color:${TEAL}; text-decoration:underline;">this link</a> so it's always one click away.</p>`
                  : ""
            }
          </td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    /* Dark mode: mail apps recolor our text; keep the button label a soft
       white on the brand teal so it stays readable (Apple Mail, iOS Mail,
       Outlook.com [data-ogsc]) */
    @media (prefers-color-scheme: dark) {
      .bx-cta, .bx-cta span { color: #F4F7FB !important; }
      .bx-cta-cell { background-color: #0a8aa3 !important; }
    }
    [data-ogsc] .bx-cta, [data-ogsc] .bx-cta span { color: #F4F7FB !important; }
    [data-ogsb] .bx-cta-cell { background-color: #0a8aa3 !important; }
  </style>
  <title>${escHtml(headline.replace(/<[^>]*>/g, ""))}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings>
  <o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0; padding:0; word-spacing:normal; background-color:#f4f7fa;">

  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${escHtml(preheader)}&nbsp;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>` : ""}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#f4f7fa; padding:40px 0; font-family:${FONT};">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
          style="background-color:#ffffff; border-radius:12px; overflow:hidden;">

          <!-- LOGO -->
          <tr>
            <td style="padding:40px 40px 24px 40px; text-align:center;">
              <img src="${LOGO_URL}" alt="${ORG_NAME}" width="180"
                style="display:block; margin:0 auto; border:0; outline:none; text-decoration:none;" />
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none; border-top:1px solid #e5e7eb; margin:0;" />
            </td>
          </tr>

          <!-- HEADLINE -->
          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <h1 style="margin:0; font-family:${FONT}; font-size:22px; font-weight:700; color:${NAVY}; letter-spacing:-0.01em;">${headline}</h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:12px 40px 0 40px; font-family:${FONT}; font-size:15px; line-height:1.6; color:#374151;">
              ${body}
            </td>
          </tr>

          ${ctaBlock}

          ${footnoteBlock}

          <!-- DIVIDER -->
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <hr style="border:none; border-top:1px solid #e5e7eb; margin:0;" />
            </td>
          </tr>

          <!-- PERSONAL SIGNATURE -->
          <tr>
            <td style="padding:20px 40px 0 40px; font-family:${FONT}; font-size:14px; line-height:1.6; color:#374151;">
              <p style="margin:0;">&mdash; ${SENDER_NAME}<br />${ORG_NAME}</p>
            </td>
          </tr>

          <!-- SECURITY FOOTER -->
          <tr>
            <td style="padding:16px 40px 40px 40px; font-family:${FONT}; font-size:12px; line-height:1.6; color:#9ca3af;">
              <p style="margin:0;">Wasn't expecting this? Call
                <a href="tel:${SUPPORT_PHONE.replace(/\D/g, '')}" style="color:#9ca3af; text-decoration:underline;">${SUPPORT_PHONE}</a>
                or email
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#9ca3af; text-decoration:underline;">${SUPPORT_EMAIL}</a>
                before clicking anything.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Email senders ────────────────────────────────────────────────────────────

/** Sent to the requester immediately after submission */
export async function sendReservationConfirmation(opts: {
  to:            string;
  name:          string;
  bookingNumber: string;
  reservationId: string;
  eventName:     string;
  dates:         string[];
  rooms:         string[];
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping confirmation");
    return;
  }
  const { to, reservationId } = opts;
  const name = escHtml(opts.name), bookingNumber = escHtml(opts.bookingNumber), eventName = escHtml(opts.eventName);
  const dates = opts.dates.map(escHtml), rooms = opts.rooms.map(escHtml);

  const html = brandedEmailHtml({
    preheader: `Your booking reference is ${opts.bookingNumber} — we'll be in touch shortly.`,
    headline:  "We received your reservation request.",
    body: `
      <p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p>
      <p style="margin:0 0 16px 0;">Thank you for submitting a space reservation request at Brainerd Baptist Church.
         Here's a summary of what we received:</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%; border-collapse:collapse; margin:16px 0 8px;">
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px; width:38%;">Booking #</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:${NAVY}; font-size:14px; font-weight:700;">${bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Event</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Date(s) &amp; Time</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${dates.length ? dates.join("<br>") : "See request"}</td>
        </tr>
        ${rooms.length > 0 ? `<tr>
          <td style="padding:10px 0; font-weight:600; color:#374151; font-size:14px;">Space(s)</td>
          <td style="padding:10px 0; color:#374151; font-size:14px;">${rooms.join(", ")}</td>
        </tr>` : ""}
      </table>
      <p style="margin:16px 0 0 0;">Our team will review your request and follow up within 2–3 business days.
         You'll receive an email when your status changes.</p>`,
    ctaText:     "View Your Request",
    ctaUrl:      `${SITE_URL}/reservations/${reservationId}`,
    footnoteHtml: `<p style="margin:0;">Reference: <strong>${bookingNumber}</strong></p>`,
  });

  await deliver({
    from:    FROM,
    to,
    subject: `Reservation Received — ${opts.bookingNumber}`,
    html,
  });
}

/** Sent to the admin inbox for every new submission */
export async function sendAdminNewReservationAlert(opts: {
  bookingNumber:  string;
  submitterName:  string;
  submitterEmail: string;
  eventName:      string;
  dates:          string[];
  rooms:          string[];
  notes?:         string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping admin alert");
    return;
  }
  const bookingNumber = escHtml(opts.bookingNumber), submitterName = escHtml(opts.submitterName);
  const submitterEmail = escHtml(opts.submitterEmail), eventName = escHtml(opts.eventName);
  const dates = opts.dates.map(escHtml), rooms = opts.rooms.map(escHtml);
  const notes = opts.notes ? escMultiline(opts.notes) : "";

  const html = brandedEmailHtml({
    preheader: `New space request from ${opts.submitterName} — ${opts.bookingNumber}`,
    headline:  "New Reservation Request",
    body: `
      <p style="margin:0 0 16px 0;">A new space reservation request has been submitted and is waiting for review.</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%; border-collapse:collapse; margin:16px 0 8px;">
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px; width:38%;">Booking #</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:${NAVY}; font-size:14px; font-weight:700;">${bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Submitted by</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${submitterName} &lt;${submitterEmail}&gt;</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Event</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; ${rooms.length > 0 || notes ? "border-bottom:1px solid #e5e7eb;" : ""} font-weight:600; color:#374151; font-size:14px;">Date(s) &amp; Time</td>
          <td style="padding:10px 0; ${rooms.length > 0 || notes ? "border-bottom:1px solid #e5e7eb;" : ""} color:#374151; font-size:14px;">${dates.length ? dates.join("<br>") : "TBD"}</td>
        </tr>
        ${rooms.length > 0 ? `<tr>
          <td style="padding:10px 0; ${notes ? "border-bottom:1px solid #e5e7eb;" : ""} font-weight:600; color:#374151; font-size:14px;">Space(s)</td>
          <td style="padding:10px 0; ${notes ? "border-bottom:1px solid #e5e7eb;" : ""} color:#374151; font-size:14px;">${rooms.join(", ")}</td>
        </tr>` : ""}
        ${notes ? `<tr>
          <td style="padding:10px 0; font-weight:600; color:#374151; font-size:14px; vertical-align:top;">Notes</td>
          <td style="padding:10px 0; color:#374151; font-size:14px;">${notes}</td>
        </tr>` : ""}
      </table>`,
    ctaText:     "Review in Admin Dashboard",
    ctaUrl:      `${SITE_URL}/admin/bx-reservations`,
    footnoteHtml: null,
  });

  await deliver({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `[BX] New Request — ${opts.bookingNumber} · ${opts.submitterName}`,
    html,
  });
}

/** Sent to the invitee when someone shares a reservation with them */
export async function sendCollaboratorInvite(opts: {
  to:          string;
  inviterName: string;
  eventName:   string;
  role:        "co_owner" | "viewer";
  acceptUrl:   string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping collaborator invite");
    return;
  }
  const { to, role, acceptUrl } = opts;
  const inviterName = escHtml(opts.inviterName), eventName = escHtml(opts.eventName);
  const roleLabel = role === "co_owner" ? "Co-owner" : "Viewer";
  const roleDesc  = role === "co_owner"
    ? "you'll be able to view and help manage the reservation"
    : "you'll be able to view reservation details";

  const html = brandedEmailHtml({
    preheader: `${opts.inviterName} invited you to collaborate on a reservation for ${opts.eventName}.`,
    headline:  "You've been invited to collaborate.",
    body: `
      <p style="margin:0 0 16px 0;"><strong style="color:${NAVY};">${inviterName}</strong> has invited you to
         collaborate on a space reservation for <strong>${eventName}</strong>.</p>
      <p style="margin:0 0 16px 0;">Your access level will be <strong>${roleLabel}</strong> — ${roleDesc}.</p>
      <p style="margin:0 0 16px 0;">Click below to accept the invitation. This link expires in 7 days.</p>
      <p style="margin:0; font-size:13px; color:#6b7280;">
        If you don't recognize this invitation, you can safely ignore this email.
      </p>`,
    ctaText: "Accept Invitation",
    ctaUrl:  acceptUrl,
    // No secondary footnote needed for invite — the tip default is fine
  });

  await deliver({
    from:    FROM,
    to,
    subject: `${opts.inviterName} invited you to a reservation — ${opts.eventName}`,
    html,
  });
}

/** Sent when an admin updates a reservation's status */
export async function sendStatusUpdateEmail(opts: {
  to:            string;
  name:          string;
  bookingNumber: string;
  reservationId: string;
  eventName:     string;
  newStatus:     "approved" | "declined" | "needs_info" | "cancelled" | "proposal_sent" | "pending_documents" | "pending_payment" | "cancelled_by_user";
  adminNote?:    string;
  agreementUrl?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping status update");
    return;
  }
  const { to, reservationId, newStatus, agreementUrl } = opts;
  const name = escHtml(opts.name), bookingNumber = escHtml(opts.bookingNumber), eventName = escHtml(opts.eventName);
  const adminNote = opts.adminNote ? escMultiline(opts.adminNote) : "";

  const noteBlock = adminNote
    ? `<p style="background:#f8fafc; border-left:3px solid ${TEAL}; padding:12px 16px; margin:16px 0; border-radius:0 6px 6px 0; color:#374151; font-size:14px;">
         <strong>Note from staff:</strong> ${adminNote}
       </p>`
    : "";

  const configs = {
    proposal_sent: {
      subject:     `Proposal Sent — ${bookingNumber}`,
      headline:    "We've reviewed your request.",
      body:        `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">We've reviewed your space reservation for <strong>${eventName}</strong> (${bookingNumber}). Our team has prepared a proposal and will be reaching out shortly to confirm the next steps.</p>${noteBlock}<p style="margin:0;">Use the button below to ${agreementUrl ? "review and sign the Facility Use Agreement" : "view your reservation details and current status"}.</p>`,
      cta:         agreementUrl ? "Sign Facility Use Agreement" : "View Your Request",
      ctaHref:     agreementUrl ?? `${SITE_URL}/reservations/${reservationId}`,
    },
    approved: {
      subject:  `Reservation Approved — ${bookingNumber}`,
      headline: "Your reservation has been approved.",
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">Great news — your space reservation for <strong>${eventName}</strong> (${bookingNumber}) has been approved.</p>${noteBlock}<p style="margin:0;">Please log in to view the full details of your approved reservation.</p><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 0;"><tr><td style="background:#F5F7FA;border:1px solid #DDE2EA;border-radius:8px;padding:20px 24px;"><p style="margin:0 0 6px 0;font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#52606F;">Guest Welcome Cards</p><p style="margin:0 0 14px 0;font-size:14px;color:#0D1B2A;line-height:1.5;">Print and set these out for your attendees — they include a free first-month BX Fitness offer, church info, and school details.</p><table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding-right:12px;"><a href="${SITE_URL}/bx-guest-card-4x6.pdf" style="display:inline-block;background:#1A8C83;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:9px 18px;border-radius:6px;">Download 4×6 Card</a></td><td><a href="${SITE_URL}/bx-guest-card-letter.pdf" style="display:inline-block;background:#ffffff;color:#1A8C83;font-size:13px;font-weight:600;text-decoration:none;padding:9px 18px;border-radius:6px;border:1.5px solid #1A8C83;">Download Letter Insert</a></td></tr></table></td></tr></table>`,
      cta:      "View Approved Reservation",
      ctaHref:  undefined as string | undefined,
    },
    declined: {
      subject:  `Reservation Update — ${bookingNumber}`,
      headline: "Your request could not be approved.",
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">After review, we're unable to approve your space reservation for <strong>${eventName}</strong> (${bookingNumber}) at this time.</p>${noteBlock}<p style="margin:0;">If you have questions or would like to submit a revised request, please contact the church office.</p>`,
      cta:      "View Request Details",
      ctaHref:  undefined as string | undefined,
    },
    needs_info: {
      subject:  `Action Needed — ${bookingNumber}`,
      headline: "Additional information needed.",
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">We're reviewing your reservation for <strong>${eventName}</strong> (${bookingNumber}) and have a few follow-up questions before we can proceed.</p>${noteBlock}<p style="margin:0;">Please log in to view the details and respond.</p>`,
      cta:      "View & Respond",
      ctaHref:  undefined as string | undefined,
    },
    cancelled: {
      subject:  `Reservation Cancelled — ${bookingNumber}`,
      headline: "Your reservation has been cancelled.",
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">Your space reservation for <strong>${eventName}</strong> (${bookingNumber}) has been cancelled.</p>${noteBlock}<p style="margin:0;">If you believe this was an error, please contact the church office.</p>`,
      cta:      "View Reservation",
      ctaHref:  undefined as string | undefined,
    },
    pending_documents: {
      subject:  `Action Required — Documents Needed · ${bookingNumber}`,
      headline: "Documents required to proceed.",
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">We need a few documents before we can finalize your reservation for <strong>${eventName}</strong> (${bookingNumber}).</p>${noteBlock}<p style="margin:0 0 16px 0;">Please log in to your reservation to upload the required documents, including your Certificate of Insurance (COI) and signed Facility Use Agreement.</p><p style="margin:0;">If you have questions about what's required, reply to this email or contact the church office.</p>`,
      cta:      "Upload Documents",
      ctaHref:  undefined as string | undefined,
    },
    pending_payment: {
      subject:  `Action Required — Payment Due · ${bookingNumber}`,
      headline: "Payment required to confirm your reservation.",
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">Your reservation for <strong>${eventName}</strong> (${bookingNumber}) is almost confirmed — we just need to receive your payment to finalize the booking.</p>${noteBlock}<p style="margin:0;">Please log in to view payment instructions and next steps.</p>`,
      cta:      "View Payment Details",
      ctaHref:  undefined as string | undefined,
    },
    cancelled_by_user: {
      subject:  `Reservation Cancelled — ${bookingNumber}`,
      headline: "Your reservation has been cancelled.",
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">Your space reservation for <strong>${eventName}</strong> (${bookingNumber}) has been cancelled at your request.</p>${noteBlock}<p style="margin:0;">If you'd like to book a space in the future, we'd love to have you — just submit a new request.</p>`,
      cta:      "View Reservation",
      ctaHref:  undefined as string | undefined,
    },
  } as const;

  const cfg = configs[newStatus];

  const html = brandedEmailHtml({
    preheader:    cfg.subject,
    headline:     cfg.headline,
    body:         cfg.body,
    ctaText:      cfg.cta,
    ctaUrl:       (cfg as typeof cfg & { ctaHref?: string }).ctaHref ?? `${SITE_URL}/reservations/${reservationId}`,
    footnoteHtml: `<p style="margin:0;">Reference: <strong>${bookingNumber}</strong></p>`,
  });

  await deliver({
    from:    FROM,
    to,
    subject: cfg.subject,
    html,
  });
}

/** Sent 48 hours before the first day of a confirmed booking */
export async function sendBookingReminder(opts: {
  to:            string;
  name:          string;
  bookingNumber: string;
  reservationId: string;
  eventName:     string;
  firstDate:     string;
  startTime:     string;
  endTime:       string;
  rooms:         string[];
  headcount:     number;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping reminder");
    return;
  }
  const { to, reservationId, headcount } = opts;
  const name = escHtml(opts.name), bookingNumber = escHtml(opts.bookingNumber), eventName = escHtml(opts.eventName);
  const firstDate = escHtml(opts.firstDate), startTime = escHtml(opts.startTime), endTime = escHtml(opts.endTime);
  const rooms = opts.rooms.map(escHtml);

  const html = brandedEmailHtml({
    preheader: `Your event "${opts.eventName}" is coming up in 48 hours — here's everything you need.`,
    headline:  "Your booking is coming up.",
    body: `
      <p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p>
      <p style="margin:0 0 16px 0;">This is a reminder that your space reservation at Brainerd Baptist Church is
         <strong>48 hours away</strong>. Here's a quick summary:</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%; border-collapse:collapse; margin:16px 0 8px;">
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px; width:38%;">Booking #</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:${NAVY}; font-size:14px; font-weight:700;">${bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Event</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Date</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${firstDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Time</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${startTime} – ${endTime}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Space(s)</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${rooms.join(", ")}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; font-weight:600; color:#374151; font-size:14px;">Headcount</td>
          <td style="padding:10px 0; color:#374151; font-size:14px;">${Number(headcount) || 0} attendees</td>
        </tr>
      </table>
      <p style="margin:16px 0 0 0;">If you have any questions or need to make last-minute changes,
         please contact the church office as soon as possible.</p>`,
    ctaText:     "View Your Booking",
    ctaUrl:      `${SITE_URL}/reservations/${reservationId}`,
    footnoteHtml: `<p style="margin:0;">Reference: <strong>${bookingNumber}</strong></p>`,
  });

  await deliver({
    from:    FROM,
    to,
    subject: `Reminder: "${opts.eventName}" is in 48 hours — ${opts.bookingNumber}`,
    html,
  });
}

/** Sent once when a new account is created (Google or email) */
export async function sendWelcomeEmail(opts: {
  to:   string;
  name: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping welcome email");
    return;
  }
  const { to, name } = opts;
  const firstName = escHtml(name.split(" ")[0]);

  const html = brandedEmailHtml({
    preheader: "Your BX Reservations account is ready — here's how to get started.",
    headline:  "Welcome to BX Reservations.",
    body: `
      <p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${firstName}</strong>,</p>
      <p style="margin:0 0 16px 0;">Your account is set up and ready to go. BX is the community center
         at Brainerd Baptist Church — available to individuals and organizations for meetings,
         events, and private gatherings.</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%; border-collapse:collapse; margin:16px 0 0 0;">
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px; color:#374151; vertical-align:top; width:22px;">
            <strong style="color:${NAVY};">1.</strong>
          </td>
          <td style="padding:10px 0 10px 10px; border-bottom:1px solid #e5e7eb; font-size:14px; color:#374151;">
            <strong>Browse available spaces</strong> — see floor plans, room capacities, and availability before you request.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px; color:#374151; vertical-align:top;">
            <strong style="color:${NAVY};">2.</strong>
          </td>
          <td style="padding:10px 0 10px 10px; border-bottom:1px solid #e5e7eb; font-size:14px; color:#374151;">
            <strong>Submit a request</strong> — fill in your event details and submit. Our team reviews every request and will be in touch within 1–2 business days.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0; font-size:14px; color:#374151; vertical-align:top;">
            <strong style="color:${NAVY};">3.</strong>
          </td>
          <td style="padding:10px 0 10px 10px; font-size:14px; color:#374151;">
            <strong>Track your booking</strong> — log in anytime to see the status of your reservation and any updates from the team.
          </td>
        </tr>
      </table>`,
    ctaText: "Reserve a Space",
    ctaUrl:  SITE_URL + "/reserve",
    footnoteHtml: `
      <p style="margin:0 0 10px 0;">
        Questions? Call <a href="tel:${SUPPORT_PHONE.replace(/\D/g, '')}" style="color:${TEAL}; text-decoration:underline;">${SUPPORT_PHONE}</a>
        or email <a href="mailto:${SUPPORT_EMAIL}" style="color:${TEAL}; text-decoration:underline;">${SUPPORT_EMAIL}</a>.
      </p>
      <p style="margin:0; color:#9ca3af; font-size:12px; line-height:1.6;">
        BX is part of Brainerd Baptist Church — we offer programs for kids, students, and adults and would love to have you visit.
        <a href="https://www.brainerdbaptist.org" style="color:#9ca3af; text-decoration:underline;">brainerdbaptist.org</a>
      </p>`,
  });

  await deliver({
    from:    FROM,
    to,
    subject: "Welcome to BX Reservations",
    html,
  });
}

// ─── Generic low-level sender ─────────────────────────────────────────────────
// Used by routes that build their own HTML rather than going through brandedEmailHtml.

export async function sendEmail(opts: {
  to:       string;
  subject:  string;
  html:     string;
  from?:    string;
  replyTo?: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping sendEmail");
    return;
  }
  await deliver({
    from:     opts.from ?? FROM,
    to:       opts.to,
    subject:  opts.subject,
    html:     opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  });
}

// ─── Payment reminder ─────────────────────────────────────────────────────────

export async function sendPaymentReminder(opts: {
  to: string;
  name: string;
  bookingNumber: string;
  reservationId: string;
  eventName: string;
  eventDate: string | null;   // "Oct 21, 2026"
  charges: number;
  paid: number;
  balance: number;
}): Promise<void> {
  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;color:#4b5563;">${label}</td><td style="padding:6px 0;text-align:right;${bold ? "font-weight:700;color:#00205b;" : "color:#111827;"}">${value}</td></tr>`;
  const html = brandedEmailHtml({
    preheader: `Balance due ${fmt(opts.balance)} for ${opts.eventName}.`,
    headline: "Payment reminder",
    body: `
      <p style="margin:0 0 16px 0;">Hi <strong style="color:#00205b;">${escHtml(opts.name.split(" ")[0] || opts.name)}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        This is a friendly reminder about the balance for <strong>${escHtml(opts.eventName)}</strong>
        (${escHtml(opts.bookingNumber)})${opts.eventDate ? ` on <strong>${escHtml(opts.eventDate)}</strong>` : ""}.
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
        ${row("Total", fmt(opts.charges))}
        ${row("Paid", fmt(opts.paid))}
        ${row("Balance due", fmt(opts.balance), true)}
      </table>
      <p style="margin:0; color:#6b7280; font-size:13px;">
        Already paid? Thank you — reply to this email and we'll update our records.
      </p>`,
    ctaText: "View your reservation",
    ctaUrl: `${SITE_URL}/reservations/${opts.reservationId}`,
    footnoteHtml: `<p style="margin:0;">Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#00abc9;">${SUPPORT_EMAIL}</a>.</p>`,
  });
  await deliver({ from: FROM, to: opts.to, subject: `Payment reminder — ${opts.bookingNumber}`, html, replyTo: SUPPORT_EMAIL });
}

// ─── Invoice / payment receipt (PDF attached) ─────────────────────────────────
export async function sendInvoiceEmail(opts: {
  to: string;
  name: string;
  bookingNumber: string;
  reservationId: string;
  eventName: string;
  kind: "invoice" | "receipt";
  totals: { charges: number; paid: number; balance: number };
  justPaid?: { amount: number; method: string } | null;
  pdf: Uint8Array;
  filename: string;
}): Promise<void> {
  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;color:#4b5563;">${label}</td><td style="padding:6px 0;text-align:right;${bold ? "font-weight:700;color:#00205b;" : "color:#111827;"}">${value}</td></tr>`;
  const first = escHtml(opts.name.split(" ")[0] || opts.name);
  const intro = opts.justPaid
    ? `Thank you — we received your payment of <strong>${fmt(opts.justPaid.amount)}</strong> (${escHtml(opts.justPaid.method)}) for <strong>${escHtml(opts.eventName)}</strong>.`
    : opts.kind === "receipt"
      ? `Here is your receipt for <strong>${escHtml(opts.eventName)}</strong> — you're paid in full. Thank you!`
      : `Here is your invoice for <strong>${escHtml(opts.eventName)}</strong>. The itemized PDF is attached.`;
  const html = brandedEmailHtml({
    preheader: opts.totals.balance > 0 ? `Balance due ${fmt(opts.totals.balance)} — ${opts.bookingNumber}` : `Paid in full — ${opts.bookingNumber}`,
    headline: opts.justPaid ? "Payment received" : opts.kind === "receipt" ? "Your receipt" : "Your invoice",
    body: `
      <p style="margin:0 0 16px 0;">Hi <strong style="color:#00205b;">${first}</strong>,</p>
      <p style="margin:0 0 16px 0;">${intro}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
        ${row("Booking", escHtml(opts.bookingNumber))}
        ${row("Total", fmt(opts.totals.charges))}
        ${row("Paid", fmt(opts.totals.paid))}
        ${row(opts.totals.balance > 0 ? "Balance due" : "Balance", fmt(Math.max(0, opts.totals.balance)), true)}
      </table>
      <p style="margin:0; color:#6b7280; font-size:13px;">The ${opts.kind === "receipt" ? "receipt" : "invoice"} is attached as a PDF for your records.</p>`,
    ctaText: "View your reservation",
    ctaUrl: `${SITE_URL}/reservations/${opts.reservationId}`,
    footnoteHtml: `<p style="margin:0;">Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#00abc9;">${SUPPORT_EMAIL}</a>.</p>`,
  });
  await deliver({
    from: FROM,
    to: opts.to,
    subject: opts.justPaid ? `Payment received — ${opts.bookingNumber}` : `${opts.kind === "receipt" ? "Receipt" : "Invoice"} — ${opts.bookingNumber} · ${opts.eventName}`,
    html,
    replyTo: SUPPORT_EMAIL,
    attachments: [{ filename: opts.filename, content: Buffer.from(opts.pdf) }],
  });
}

// ─── Cancellation notice (everyone on the booking) ────────────────────────────
export async function sendCancellationNotice(opts: {
  to: string;
  bookingNumber: string;
  reservationId: string;
  eventName: string;
  who: string;        // "Jane Smith (co-organizer)"
  when: string;       // "Wed, Oct 1, 2026, 3:42 PM ET"
  reason: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const html = brandedEmailHtml({
    preheader: `${opts.eventName} (${opts.bookingNumber}) was cancelled by ${opts.who}.`,
    headline: "This booking was cancelled.",
    body: `
      <p style="margin:0 0 16px 0;"><strong style="color:${NAVY};">${escHtml(opts.eventName)}</strong> (${escHtml(opts.bookingNumber)}) has been cancelled.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px 0;border-top:1px solid #e5e7eb;">
        <tr><td style="padding:8px 0;color:#6b7280;width:32%;border-bottom:1px solid #e5e7eb;">Cancelled by</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${escHtml(opts.who)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #e5e7eb;">When</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${escHtml(opts.when)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Reason</td><td style="padding:8px 0;">${escMultiline(opts.reason)}</td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;">You're getting this because you're on this booking. Questions? Reply to this email.</p>`,
    ctaText: "View the booking",
    ctaUrl: `${SITE_URL}/reservations/${opts.reservationId}`,
    footnoteHtml: null,
  });
  await deliver({ from: FROM, to: opts.to, subject: `Cancelled: ${opts.eventName} — ${opts.bookingNumber}`, html });
}

// ─── Quote for approval (v1.59) ───────────────────────────────────────────────
type QuoteEmailLine = { label: string; note: string | null; unit_price: number; quantity: number; amount: number };
const usdFmt = (n: number) => (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
const longYmd = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Itemized table that reads well in Gmail, Apple Mail and Outlook. */
function quoteTableHtml(lines: QuoteEmailLine[], subtotal: number, discounts: number, total: number): string {
  const rows = lines.map((l) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef0f3;vertical-align:top;">
        <div style="color:#111827;font-size:14px;">${escHtml(l.label)}</div>
        ${l.quantity !== 1 || l.note ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;">${l.quantity !== 1 ? `${l.quantity} × ${usdFmt(l.unit_price)}` : ""}${l.quantity !== 1 && l.note ? " · " : ""}${l.note ? escHtml(l.note) : ""}</div>` : ""}
      </td>
      <td style="padding:10px 0 10px 12px;border-bottom:1px solid #eef0f3;text-align:right;vertical-align:top;white-space:nowrap;color:${l.amount < 0 ? "#15803d" : "#111827"};font-size:14px;">${usdFmt(l.amount)}</td>
    </tr>`).join("");
  const sumRow = (label: string, v: string, strong = false) =>
    `<tr><td style="padding:6px 0;color:${strong ? NAVY : "#4b5563"};${strong ? "font-weight:700;font-size:16px;" : "font-size:14px;"}">${label}</td><td style="padding:6px 0;text-align:right;color:${strong ? NAVY : "#111827"};${strong ? "font-weight:700;font-size:16px;" : "font-size:14px;"}">${v}</td></tr>`;
  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 8px 0;border-top:2px solid ${NAVY};">${rows}</table>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px 0;">
      ${sumRow("Subtotal", usdFmt(subtotal))}
      ${discounts ? sumRow("Discounts", usdFmt(discounts)) : ""}
      ${sumRow("Quote total", usdFmt(total), true)}
    </table>`;
}

export async function sendQuoteEmail(opts: {
  to: string; name: string; bookingNumber: string; eventName: string; version: number;
  lines: QuoteEmailLine[]; subtotal: number; discounts: number; total: number;
  validUntil: string | null; url: string; includesAgreement: boolean; note: string | null;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) { console.warn("[email] RESEND_API_KEY not set — skipping quote"); return false; }
  const first = escHtml(opts.name.split(" ")[0] || opts.name);
  const html = brandedEmailHtml({
    preheader: `Your quote for ${opts.eventName}: ${usdFmt(opts.total)}. Review and approve online.`,
    headline: opts.version > 1 ? "Your updated quote" : "Your quote is ready",
    body: `
      <p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${first}</strong>,</p>
      <p style="margin:0 0 16px 0;">Here's the itemized quote for <strong>${escHtml(opts.eventName)}</strong> (${escHtml(opts.bookingNumber)}).
      Please look it over and approve it online${opts.includesAgreement ? " — the same signature signs your Facility Use Agreement" : ""}.</p>
      ${opts.note ? `<p style="background:#f8fafc;border-left:3px solid ${TEAL};padding:12px 16px;margin:0 0 16px 0;border-radius:0 6px 6px 0;color:#374151;font-size:14px;"><strong>Note from the BX team:</strong> ${escMultiline(opts.note)}</p>` : ""}
      ${quoteTableHtml(opts.lines, opts.subtotal, opts.discounts, opts.total)}
      <p style="margin:0 0 4px 0;color:#4b5563;font-size:13px;">Prices include table/chair set-up and tear-down and trash removal at the close of the event.</p>
      ${opts.validUntil ? `<p style="margin:0;color:#4b5563;font-size:13px;">This quote is good until <strong>${longYmd(opts.validUntil)}</strong>.</p>` : ""}`,
    ctaText: "Review & approve quote",
    ctaUrl: opts.url,
    footnoteHtml: `<p style="margin:0;">Questions or changes? Ask or request changes right on the quote page, reply to this email, or call ${SUPPORT_PHONE}.</p>`,
  });
  await deliver({
    from: FROM, to: opts.to, replyTo: SUPPORT_EMAIL, html,
    subject: `${opts.version > 1 ? "Updated quote" : "Your quote"} — ${opts.bookingNumber} · ${opts.eventName}`,
  });
  return true;
}

/** After approval: a copy for the organizer (PDF attached) and an alert for the BX inbox. */
export async function sendQuoteApprovedEmails(opts: {
  to: string | null; name: string; signer: string; bookingNumber: string; reservationId: string; eventName: string;
  version: number; total: number; signedAt: string; includesAgreement: boolean; nextStep: string;
  hasStripe?: boolean;
  pdf: Uint8Array; filename: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) { console.warn("[email] RESEND_API_KEY not set — skipping quote approval"); return; }
  const when = new Date(opts.signedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " ET";
  const what = `quote${opts.includesAgreement ? " and Facility Use Agreement" : ""}`;
  const bookingUrl = `${SITE_URL}/reservations/${opts.reservationId}`;
  // When a balance is owed and Stripe is set up, add a pay-now section before the next-step line
  const paySection = opts.hasStripe && opts.total > 0
    ? `<p style="margin:0 0 16px 0;"><strong>Balance due: ${usdFmt(opts.total)}</strong> — you can pay securely by card on your booking page.</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px 0;">
        <tr><td style="border-radius:6px;background:${TEAL};">
          <a href="${bookingUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Pay ${usdFmt(opts.total)} now →</a>
        </td></tr>
      </table>`
    : `<p style="margin:0 0 16px 0;font-size:16px;color:${NAVY};"><strong>Approved total: ${usdFmt(opts.total)}</strong></p>`;
  if (opts.to) {
    await deliver({
      from: FROM, to: opts.to, replyTo: SUPPORT_EMAIL,
      subject: `Quote approved — ${opts.bookingNumber} · ${opts.eventName}`,
      html: brandedEmailHtml({
        preheader: `You approved ${usdFmt(opts.total)} for ${opts.eventName}.${opts.hasStripe && opts.total > 0 ? " Pay your balance by card on your booking page." : ""}`,
        headline: "Thank you — quote approved",
        body: `
          <p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${escHtml(opts.name.split(" ")[0] || opts.name)}</strong>,</p>
          <p style="margin:0 0 16px 0;"><strong>${escHtml(opts.signer)}</strong> approved the ${what} for <strong>${escHtml(opts.eventName)}</strong> (${escHtml(opts.bookingNumber)}) on ${when}.
          The signed copy is attached for your records.</p>
          ${paySection}
          <p style="margin:0;"><strong>Next:</strong> ${escHtml(opts.nextStep)}</p>`,
        ctaText: "View your booking",
        ctaUrl: bookingUrl,
        footnoteHtml: `<p style="margin:0;">Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:${TEAL};">${SUPPORT_EMAIL}</a>.</p>`,
      }),
      attachments: [{ filename: opts.filename, content: Buffer.from(opts.pdf) }],
    });
  }
  await deliver({
    from: FROM, to: ADMIN_EMAIL,
    subject: `Quote approved — ${opts.bookingNumber} (${opts.eventName}) ${usdFmt(opts.total)}`,
    html: brandedEmailHtml({
      headline: "Quote approved",
      body: `<p style="margin:0 0 12px 0;"><strong style="color:${NAVY};">${escHtml(opts.signer)}</strong> approved quote v${opts.version} (${usdFmt(opts.total)})${opts.includesAgreement ? " and signed the Facility Use Agreement" : ""} for <strong>${escHtml(opts.eventName)}</strong> (${escHtml(opts.bookingNumber)}) on ${when}.</p><p style="margin:0;">Next for the guest: ${escHtml(opts.nextStep)}</p>`,
      ctaText: "Open the booking",
      ctaUrl: `${SITE_URL}/reservations/${opts.reservationId}`,
      footnoteHtml: null,
    }),
    attachments: [{ filename: opts.filename, content: Buffer.from(opts.pdf) }],
  });
}

/** Sent to the organizer by admin — asks them to upload their event schedule */
export async function sendScheduleRequest(opts: {
  to:            string;
  name:          string;
  bookingNumber: string;
  eventName:     string;
  uploadToken:   string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping schedule request");
    return;
  }
  const { to, name, bookingNumber, eventName, uploadToken } = opts;
  const uploadUrl = `${SITE_URL}/schedule-upload/${uploadToken}`;

  const html = brandedEmailHtml({
    preheader: `Please upload your event schedule for ${bookingNumber} to help us finalize your booking.`,
    headline:  "One more thing — your event schedule.",
    body: `
      <p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        Thank you for your reservation request for <strong>${eventName}</strong> (${bookingNumber}).
        To help us finalize your booking, we need your event schedule — a document that outlines
        the timeline and activities planned for your event.
      </p>
      <p style="margin:0 0 16px 0;">
        Your schedule helps our events team prepare the space, coordinate A/V, and ensure everything
        runs smoothly on your day.
      </p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%; border-collapse:collapse; margin:0 0 20px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:14px 16px; font-size:13px; color:#6b7280;">
            <strong style="color:#111827; display:block; margin-bottom:4px;">What to include:</strong>
            Start &amp; end times, session titles, any breaks, and any special setup changes during the event.
            A Word doc, PDF, or even a clear photo of a handwritten schedule works fine.
          </td>
        </tr>
      </table>`,
    ctaText:     "Upload Your Schedule",
    ctaUrl:      uploadUrl,
    footnoteHtml: `
      <p style="margin:0 0 10px 0; font-size:13px; color:#6b7280;">
        This link is unique to your booking and expires after upload. If you have questions,
        reply to this email or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${TEAL};">${SUPPORT_EMAIL}</a>.
      </p>
      <p style="margin:0; font-size:13px; color:#6b7280;">Reference: <strong>${bookingNumber}</strong></p>`,
  });

  await getResend().emails.send({
    from:    FROM,
    to,
    subject: `Event Schedule Needed — ${bookingNumber}`,
    html,
  });
}

// ─── Payment receipt & admin alert ───────────────────────────────────────────

function progressBarHtml(paid: number, charges: number): string {
  if (charges <= 0) return "";
  const pct = Math.min(100, Math.round((paid / charges) * 100));
  const label = pct >= 100
    ? `<span style="font-size:13px; color:#059669; font-weight:700;">Paid in full ✓</span>`
    : `<span style="font-size:13px; color:#374151;"><strong style="color:${NAVY};">${usd(paid)}</strong> paid &nbsp;·&nbsp; <strong>${usd(charges - paid)}</strong> remaining</span>`;
  const filled = pct >= 100
    ? `border-radius:6px; background:${TEAL};`
    : `border-radius:6px 0 0 6px; background:${TEAL};`;
  const empty  = pct >= 100 ? "" : `<td style="height:8px; background:#e5e7eb; border-radius:0 6px 6px 0;"></td>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 4px 0;">
      <tr><td style="padding-bottom:6px;">${label}</td></tr>
      <tr>
        <td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px; background:#e5e7eb; overflow:hidden;">
            <tr>
              <td width="${pct}%" style="height:8px; ${filled}"></td>
              ${empty}
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function checklistItemHtml(state: "done" | "todo" | "optional", label: string, href?: string | null, note?: string | null): string {
  const icon  = state === "done"     ? `<td style="width:22px; padding:5px 0; vertical-align:top; font-size:15px; color:#059669;">✓</td>`
              : state === "todo"     ? `<td style="width:22px; padding:5px 0; vertical-align:top; font-size:15px; color:#d97706;">→</td>`
              :                        `<td style="width:22px; padding:5px 0; vertical-align:top; font-size:15px; color:#9ca3af;">○</td>`;
  const text  = href
    ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${TEAL}; text-decoration:underline; font-weight:600;">${escHtml(label)}</a>`
    : escHtml(label);
  const noteEl = note ? `<br><span style="font-size:12px; color:#9ca3af;">${escHtml(note)}</span>` : "";
  return `<tr>${icon}<td style="padding:5px 0 5px 6px; font-size:14px; color:#374151;">${text}${noteEl}</td></tr>`;
}

function sectionHeadingHtml(text: string): string {
  return `<p style="margin:20px 0 8px 0; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#9ca3af;">${escHtml(text)}</p>`;
}

function infoRowHtml(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:5px 12px 5px 0; font-size:13px; color:#9ca3af; white-space:nowrap; vertical-align:top;">${escHtml(label)}</td>
      <td style="padding:5px 0; font-size:13px; color:#374151; vertical-align:top;">${value}</td>
    </tr>`;
}

export interface PaymentReadiness {
  reservationId:   string;
  bookingNumber:   string;
  contactName:     string;
  contactEmail:    string;
  eventName:       string;
  eventDates:      string[];   // YMD strings
  roomNames:       string[];
  headcount:       number;
  amountPaid:      number;     // this payment
  totalPaid:       number;     // after this payment
  totalCharges:    number;
  // Required steps
  agreementSigned: boolean;
  agreementToken:  string | null;
  coiAccepted:     boolean;
  coiUploaded:     boolean;    // uploaded but not yet accepted
  // Optional
  logoUploaded:    boolean;
  labelCount:      number;
  // Waivers
  waivedAgreement: boolean;
  waivedCoi:       boolean;
  waivedPayment:   boolean;
}

/** Rich payment receipt to the renter — sent immediately on payment_intent.succeeded. */
export async function sendPaymentReceiptEmail(r: PaymentReadiness): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping payment receipt");
    return;
  }

  const { SITE_URL, SUPPORT_EMAIL, SUPPORT_PHONE } = await import("@/lib/site");

  const bn          = r.bookingNumber;
  const eventUrl    = `${SITE_URL}/reservations/${r.reservationId}`;
  const name        = r.contactName || r.contactEmail;
  const paidFull    = r.totalCharges > 0 && r.totalCharges - r.totalPaid <= 0;
  const datesLabel  = r.eventDates.slice(0, 3).map((d) => {
    const dt = new Date(`${d}T12:00:00Z`);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }).join(" · ") + (r.eventDates.length > 3 ? ` + ${r.eventDates.length - 3} more` : "");

  // Event detail card
  const eventCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:16px 0; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
      <tr><td style="padding:14px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${r.eventDates.length ? infoRowHtml("Date", escHtml(datesLabel)) : ""}
          ${r.roomNames.length  ? infoRowHtml("Spaces", escHtml(r.roomNames.join(", "))) : ""}
          ${r.headcount > 0     ? infoRowHtml("Guests", escHtml(String(r.headcount))) : ""}
        </table>
      </td></tr>
    </table>`;

  // Payment progress
  const progress = progressBarHtml(r.totalPaid, r.totalCharges);

  // Required steps (only items that are still open)
  const requiredRows: string[] = [];
  if (!r.waivedAgreement) {
    if (r.agreementSigned) {
      requiredRows.push(checklistItemHtml("done", "Facility Use Agreement signed"));
    } else {
      const href = r.agreementToken
        ? `${SITE_URL}/reservations/${r.reservationId}/agreement?token=${r.agreementToken}`
        : null;
      requiredRows.push(checklistItemHtml("todo", "Sign the Facility Use Agreement", href, href ? null : "We'll send this link separately."));
    }
  }
  if (!r.waivedCoi) {
    if (r.coiAccepted) {
      requiredRows.push(checklistItemHtml("done", "Proof of insurance accepted"));
    } else if (r.coiUploaded) {
      requiredRows.push(checklistItemHtml("done", "Proof of insurance uploaded — under review"));
    } else {
      requiredRows.push(checklistItemHtml("todo", "Upload proof of insurance", `${eventUrl}#documents`,
        "A Certificate of Insurance (COI) naming Brainerd Baptist Church as additionally insured."));
    }
  }

  // Optional steps (always shown as prompts if not done)
  const optionalRows: string[] = [];
  if (!r.logoUploaded) {
    optionalRows.push(checklistItemHtml("optional", "Upload your logo", `${eventUrl}#logo`,
      "We use it to make custom entry signs and event materials for you."));
  }
  if (r.labelCount === 0) {
    optionalRows.push(checklistItemHtml("optional", "Name your rooms on the Event Map", `${eventUrl}/event-map`,
      "Adds personalized door signs to each space you're using."));
  }

  const requiredSection = requiredRows.length
    ? `${sectionHeadingHtml("Still needed")}<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${requiredRows.join("")}</table>`
    : "";
  const optionalSection = optionalRows.length
    ? `${sectionHeadingHtml("Optional but helpful")}<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${optionalRows.join("")}</table>`
    : "";

  const amountLine = r.amountPaid !== r.totalPaid
    ? `<strong style="color:${NAVY};">${usd(r.amountPaid)}</strong> received — ${usd(r.totalPaid)} paid total`
    : `<strong style="color:${NAVY};">${usd(r.amountPaid)}</strong> received`;

  const body = `
    <p style="margin:0 0 4px 0;">Hi <strong style="color:${NAVY};">${escHtml(name)}</strong>,</p>
    <p style="margin:0 0 16px 0;">We received your payment for <strong>${escHtml(r.eventName)}</strong> (${escHtml(bn)}).</p>
    <p style="margin:0 0 4px 0; font-size:15px;">${amountLine}</p>
    ${r.totalCharges > 0 ? progress : ""}
    ${eventCard}
    ${requiredSection}
    ${optionalSection}
    <p style="margin:${requiredRows.length || optionalRows.length ? "16" : "0"}px 0 0 0; font-size:13px; color:#6b7280;">
      Questions? Reply to this email or call <a href="tel:${SUPPORT_PHONE.replace(/\D/g, "")}" style="color:${TEAL};">${SUPPORT_PHONE}</a>.
    </p>`;

  await deliver({
    from: FROM, to: r.contactEmail,
    subject: paidFull
      ? `Payment complete — ${escHtml(r.eventName)} (${bn})`
      : `Payment received — ${escHtml(r.eventName)} (${bn})`,
    html: brandedEmailHtml({
      preheader: paidFull ? `Paid in full for ${r.eventName}.` : `${usd(r.amountPaid)} received for ${r.eventName}.`,
      headline: paidFull ? "You're all paid up!" : "Payment received",
      body,
      ctaText: "View your reservation",
      ctaUrl:  eventUrl,
      footnoteHtml: null,
    }),
  });
}

/** Alert sent to Barb + finance immediately when a payment lands. */
export async function sendAdminPaymentAlert(r: PaymentReadiness): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping admin payment alert");
    return;
  }

  const { SITE_URL, BX_COORDINATOR_EMAIL, FINANCE_EMAIL } = await import("@/lib/site");

  const recipients = [BX_COORDINATOR_EMAIL, FINANCE_EMAIL].filter(Boolean);
  if (!recipients.length) {
    console.log("[email] No payment alert recipients configured — skipping admin alert (set BX_COORDINATOR_EMAIL and FINANCE_EMAIL in Vercel Production env)");
    return;
  }

  const bn         = r.bookingNumber;
  const adminUrl   = `${SITE_URL}/admin/bx-reservations?highlight=${r.reservationId}`;
  const paidFull   = r.totalCharges > 0 && r.totalCharges - r.totalPaid <= 0;
  const firstDate  = r.eventDates[0]
    ? new Date(`${r.eventDates[0]}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  const agStatus = r.waivedAgreement ? "Waived" : r.agreementSigned ? "✓ Signed" : "Not yet signed";
  const coiStatus = r.waivedCoi ? "Waived"
    : r.coiAccepted  ? "✓ Accepted"
    : r.coiUploaded  ? "⏳ Uploaded — pending review"
    : "Not uploaded";

  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="margin:0 0 20px 0; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
      <tr><td style="padding:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoRowHtml("From",      `<strong style="color:${NAVY};">${escHtml(r.contactName || r.contactEmail)}</strong> &lt;<a href="mailto:${escHtml(r.contactEmail)}" style="color:${TEAL};">${escHtml(r.contactEmail)}</a>&gt;`)}
          ${infoRowHtml("Event",     `<strong>${escHtml(r.eventName)}</strong>`)}
          ${firstDate ? infoRowHtml("Date",  escHtml(firstDate)) : ""}
          ${r.roomNames.length ? infoRowHtml("Spaces", escHtml(r.roomNames.join(", "))) : ""}
          ${infoRowHtml("Booking #", escHtml(bn))}
        </table>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="margin:0 0 20px 0; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0;">
      <tr><td style="padding:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoRowHtml("This payment", `<strong style="color:${NAVY}; font-size:16px;">${usd(r.amountPaid)}</strong>`)}
          ${r.totalCharges > 0 ? infoRowHtml("Total paid",  `${usd(r.totalPaid)} of ${usd(r.totalCharges)}`) : ""}
          ${r.totalCharges > 0 ? infoRowHtml("Balance",     paidFull ? `<strong style="color:#059669;">Paid in full ✓</strong>` : `<strong>${usd(r.totalCharges - r.totalPaid)}</strong> remaining`) : ""}
        </table>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="margin:0 0 8px 0; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
      <tr><td style="padding:14px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoRowHtml("Agreement", escHtml(agStatus))}
          ${infoRowHtml("Insurance", escHtml(coiStatus))}
        </table>
      </td></tr>
    </table>`;

  await deliver({
    from: FROM, to: recipients,
    subject: `Payment received — ${r.eventName} · ${usd(r.amountPaid)} (${bn})`,
    html: brandedEmailHtml({
      preheader: `${usd(r.amountPaid)} from ${r.contactName || r.contactEmail} for ${r.eventName}.`,
      headline: "Payment received",
      body,
      ctaText: "Open in admin",
      ctaUrl:  adminUrl,
      footnoteHtml: null,
    }),
  });
}

/** Event-prep nudge — sent ~30 days out (kind "prep:30") and ~7 days out (kind "prep:7").
 *  Only fires when there are optional or required items still open. */
export async function sendEventPrepEmail(r: PaymentReadiness & {
  kind: "prep:30" | "prep:7";
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping event prep email");
    return;
  }

  const { SITE_URL, SUPPORT_EMAIL, SUPPORT_PHONE } = await import("@/lib/site");
  const eventUrl = `${SITE_URL}/reservations/${r.reservationId}`;
  const name     = r.contactName || r.contactEmail;
  const bn       = r.bookingNumber;
  const isFinal  = r.kind === "prep:7";

  const firstDate = r.eventDates[0]
    ? new Date(`${r.eventDates[0]}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  // Required items still open
  const requiredOpen: string[] = [];
  if (!r.waivedAgreement && !r.agreementSigned) {
    const href = r.agreementToken ? `${SITE_URL}/reservations/${r.reservationId}/agreement?token=${r.agreementToken}` : null;
    requiredOpen.push(checklistItemHtml("todo", "Sign the Facility Use Agreement", href, null));
  }
  if (!r.waivedCoi && !r.coiAccepted && !r.coiUploaded) {
    requiredOpen.push(checklistItemHtml("todo", "Upload proof of insurance", `${eventUrl}#documents`,
      "A Certificate of Insurance (COI) naming Brainerd Baptist Church as additionally insured."));
  }
  if (!r.waivedPayment && r.totalCharges > 0 && r.totalCharges - r.totalPaid > 0) {
    requiredOpen.push(checklistItemHtml("todo", `Pay the remaining balance (${usd(r.totalCharges - r.totalPaid)})`, `${eventUrl}#billing`, null));
  }

  // Optional items still open
  const optionalOpen: string[] = [];
  if (!r.logoUploaded) {
    optionalOpen.push(checklistItemHtml("optional", "Upload your logo for custom signage", `${eventUrl}#logo`,
      "We print entry signs and event materials with your logo."));
  }
  if (r.labelCount === 0) {
    optionalOpen.push(checklistItemHtml("optional", "Name your rooms on the Event Map", `${eventUrl}/event-map`,
      "Door signs are printed from the room names you set here."));
  }
  if (r.headcount >= 75) {
    optionalOpen.push(checklistItemHtml("optional", "Share your event schedule or run of show", `${eventUrl}`,
      "Helps our team prepare spaces and AV for your timeline."));
  }

  // Nothing to say → skip
  if (!requiredOpen.length && !optionalOpen.length && !isFinal) return;

  const requiredSection = requiredOpen.length
    ? `${sectionHeadingHtml("Still needed before your event")}<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${requiredOpen.join("")}</table>`
    : "";
  const optionalSection = optionalOpen.length
    ? `${sectionHeadingHtml("Optional — but helpful for your team")}<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${optionalOpen.join("")}</table>`
    : "";

  const dayOfSection = isFinal ? `
    ${sectionHeadingHtml("Day-of details")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:8px 0 12px 0; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
      <tr><td style="padding:14px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoRowHtml("BX contact",   escHtml(SUPPORT_EMAIL))}
          ${infoRowHtml("Phone",         escHtml(SUPPORT_PHONE))}
          ${infoRowHtml("Parking",       "Main lot off Missionary Ridge Road; overflow in the lower campus lot.")}
          ${infoRowHtml("Arrival",       "You may access your reserved spaces starting at the time shown on your booking.")}
        </table>
      </td></tr>
    </table>` : "";

  const intro = isFinal
    ? `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${escHtml(name)}</strong>, your event is just around the corner${firstDate ? ` — <strong>${escHtml(firstDate)}</strong>` : ""}. Here's everything to have ready.</p>`
    : `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${escHtml(name)}</strong>, your event is coming up${firstDate ? ` on <strong>${escHtml(firstDate)}</strong>` : ""}. A quick checklist to make sure everything is set.</p>`;

  const body = `
    ${intro}
    ${requiredSection}
    ${optionalSection}
    ${dayOfSection}
    <p style="margin:16px 0 0 0; font-size:13px; color:#6b7280;">
      Questions? Reply to this email or call <a href="tel:${SUPPORT_PHONE.replace(/\D/g, "")}" style="color:${TEAL};">${SUPPORT_PHONE}</a>.
      &nbsp;<span style="color:#d1d5db;">|</span>&nbsp; Booking ${escHtml(bn)}
    </p>`;

  const subject = isFinal
    ? `Final details — ${r.eventName}${firstDate ? " · " + firstDate : ""}`
    : `Getting ready for your event — ${r.eventName} (${bn})`;

  await deliver({
    from: FROM, to: r.contactEmail,
    subject,
    html: brandedEmailHtml({
      preheader: isFinal
        ? `Your event is almost here. Here's what's needed and your day-of details.`
        : `A quick checklist to make sure everything is ready for ${r.eventName}.`,
      headline: isFinal ? "Final event checklist" : "Getting ready for your event",
      body,
      ctaText: "View your reservation",
      ctaUrl:  eventUrl,
      footnoteHtml: null,
    }),
  });
}
