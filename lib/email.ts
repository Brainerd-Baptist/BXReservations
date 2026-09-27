import { Resend } from "resend";

// Lazy-initialize so the build succeeds even before RESEND_API_KEY is set in Vercel
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
                <td style="background-color:${TEAL}; border-radius:8px;">
                  <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
                    style="display:inline-block; color:${WHITE}; font-family:${FONT}; font-size:15px; font-weight:700; text-decoration:none; padding:13px 28px;">
                    <span style="color:${WHITE}; text-decoration:none;">${ctaText}</span>
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
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${headline}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings>
  <o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0; padding:0; word-spacing:normal; background-color:#f4f7fa;">

  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${preheader}&nbsp;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>` : ""}

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
              <p style="margin:0;">Wasn't expecting this? Call or text
                <a href="tel:4236434978" style="color:#9ca3af; text-decoration:underline;">${SUPPORT_PHONE}</a>
                before clicking anything &mdash; or email
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#9ca3af; text-decoration:underline;">${SUPPORT_EMAIL}</a>.
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
  const { to, name, bookingNumber, reservationId, eventName, dates, rooms } = opts;

  const html = brandedEmailHtml({
    preheader: `Your booking reference is ${bookingNumber} — we'll be in touch shortly.`,
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
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-weight:600; color:#374151; font-size:14px;">Date(s)</td>
          <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; color:#374151; font-size:14px;">${dates.length ? dates.join(", ") : "See request"}</td>
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

  await getResend().emails.send({
    from:    FROM,
    to,
    subject: `Reservation Received — ${bookingNumber}`,
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
  const { bookingNumber, submitterName, submitterEmail, eventName, dates, rooms, notes } = opts;

  const html = brandedEmailHtml({
    preheader: `New space request from ${submitterName} — ${bookingNumber}`,
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
          <td style="padding:10px 0; ${rooms.length > 0 || notes ? "border-bottom:1px solid #e5e7eb;" : ""} font-weight:600; color:#374151; font-size:14px;">Date(s)</td>
          <td style="padding:10px 0; ${rooms.length > 0 || notes ? "border-bottom:1px solid #e5e7eb;" : ""} color:#374151; font-size:14px;">${dates.length ? dates.join(", ") : "TBD"}</td>
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

  await getResend().emails.send({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `[BX] New Request — ${bookingNumber} · ${submitterName}`,
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
  const { to, inviterName, eventName, role, acceptUrl } = opts;
  const roleLabel = role === "co_owner" ? "Co-owner" : "Viewer";
  const roleDesc  = role === "co_owner"
    ? "you'll be able to view and help manage the reservation"
    : "you'll be able to view reservation details";

  const html = brandedEmailHtml({
    preheader: `${inviterName} invited you to collaborate on a reservation for ${eventName}.`,
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

  await getResend().emails.send({
    from:    FROM,
    to,
    subject: `${inviterName} invited you to a reservation — ${eventName}`,
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
  const { to, name, bookingNumber, reservationId, eventName, newStatus, adminNote, agreementUrl } = opts;

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
      body:     `<p style="margin:0 0 16px 0;">Hi <strong style="color:${NAVY};">${name}</strong>,</p><p style="margin:0 0 16px 0;">Great news — your space reservation for <strong>${eventName}</strong> (${bookingNumber}) has been approved.</p>${noteBlock}<p style="margin:0;">Please log in to view the full details of your approved reservation.</p>`,
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

  await getResend().emails.send({
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
  const { to, name, bookingNumber, reservationId, eventName, firstDate, startTime, endTime, rooms, headcount } = opts;

  const html = brandedEmailHtml({
    preheader: `Your event "${eventName}" is coming up in 48 hours — here's everything you need.`,
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
          <td style="padding:10px 0; color:#374151; font-size:14px;">${headcount} attendees</td>
        </tr>
      </table>
      <p style="margin:16px 0 0 0;">If you have any questions or need to make last-minute changes,
         please contact the church office as soon as possible.</p>`,
    ctaText:     "View Your Booking",
    ctaUrl:      `${SITE_URL}/reservations/${reservationId}`,
    footnoteHtml: `<p style="margin:0;">Reference: <strong>${bookingNumber}</strong></p>`,
  });

  await getResend().emails.send({
    from:    FROM,
    to,
    subject: `Reminder: "${eventName}" is in 48 hours — ${bookingNumber}`,
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
  await getResend().emails.send({
    from:     opts.from ?? FROM,
    to:       opts.to,
    subject:  opts.subject,
    html:     opts.html,
    ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
  });
}
