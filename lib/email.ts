import { Resend } from "resend";

// Lazy-initialize so the build succeeds even before RESEND_API_KEY is set in Vercel
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/** Send through Resend and throw on failure — Resend reports errors in the
 *  result instead of throwing, so failures used to be logged as "sent OK". */
async function deliver(payload: Parameters<ReturnType<typeof getResend>["emails"]["send"]>[0]) {
  const { error } = await getResend().emails.send(payload);
  if (error) throw new Error(`Resend: ${error.name ?? "error"} — ${error.message}`);
}

/** Escape text people typed (names, event names, notes) before it goes into
 *  email HTML — otherwise anyone could put links or markup into a church email. */
export const escHtml = (t: unknown) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
/** Escaped, with line breaks kept. */
export const escMultiline = (t: unknown) => escHtml(t).replace(/\r?\n/g, "<br>");

const FROM        = process.env.EMAIL_FROM ?? "BX Reservations <noreply@brainerdhq.app>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jking@brainerdbaptist.org";
const SITE_URL    = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app").replace(/\/$/, "");

// ─── Design tokens ────────────────────────────────────────────────────────────
// Update these if Brainerd's brand colors ever change.
const NAVY  = "#00205b";   // headlines, bold emphasis, secondary button text
const TEAL  = "#00abc9";   // primary button background, inline links
const WHITE = "#ffffff";   // primary button text

const FONT     = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const LOGO_URL = "https://bbc-team-dashboard.vercel.app/brainerd-logo.png";

// Footer contact shown in the security line
const SUPPORT_PHONE = "(423) 643-4978";
const SUPPORT_EMAIL = "BXreservations@brainerdbaptist.org";
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
                <a href="tel:4236434978" style="color:#9ca3af; text-decoration:underline;">${SUPPORT_PHONE}</a>
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
      subject:     `Your BX Reservation — Proposal Ready · ${bookingNumber}`,
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
        Questions? Call <a href="tel:4236434978" style="color:${TEAL}; text-decoration:underline;">${SUPPORT_PHONE}</a>
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
    footnoteHtml: `<p style="margin:0;">Questions? Email <a href="mailto:BXreservations@brainerdbaptist.org" style="color:#00abc9;">BXreservations@brainerdbaptist.org</a>.</p>`,
  });
  await deliver({ from: FROM, to: opts.to, subject: `Payment reminder — ${opts.bookingNumber}`, html, replyTo: "BXreservations@brainerdbaptist.org" });
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
    footnoteHtml: `<p style="margin:0;">Questions? Email <a href="mailto:BXreservations@brainerdbaptist.org" style="color:#00abc9;">BXreservations@brainerdbaptist.org</a>.</p>`,
  });
  await deliver({
    from: FROM,
    to: opts.to,
    subject: opts.justPaid ? `Payment received — ${opts.bookingNumber}` : `${opts.kind === "receipt" ? "Receipt" : "Invoice"} — ${opts.bookingNumber} · ${opts.eventName}`,
    html,
    replyTo: "BXreservations@brainerdbaptist.org",
    attachments: [{ filename: opts.filename, content: Buffer.from(opts.pdf) }],
  });
}
