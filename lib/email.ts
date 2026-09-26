import { Resend } from "resend";

// Lazy-initialize so the build succeeds even before RESEND_API_KEY is set in Vercel
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "BX Reservations <noreply@brainerdhq.app>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jking@brainerdbaptist.org";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app").replace(/\/$/, "");

// ─── Design tokens (inline — no CSS classes; email-client safe) ───────────────
const C = {
  blue:        "#00205b",   // Brainerd Blue — headlines, emphasis
  teal:        "#00abc9",   // CTA buttons, links
  body:        "#374151",
  muted:       "#6b7280",
  light:       "#9ca3af",
  bg:          "#f4f5f7",
  card:        "#ffffff",
  border:      "#e5e7eb",
  rowAlt:      "#f8fafc",
  buttonBg:    "#00abc9",
  buttonText:  "#ffffff",
};
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
// Hosted on the BBC Team Dashboard — stable public URL used for email logo
const LOGO_URL = "https://bbc-team-dashboard.vercel.app/brainerd-logo.png";

// ─── Core HTML builder ────────────────────────────────────────────────────────

export function brandedEmailHtml(opts: {
  preheader?: string;
  headline:   string;
  body:       string;   // HTML — paragraphs, tables, etc.
  ctaText?:   string;
  ctaUrl?:    string;
  footerNote?: string;
}): string {
  const { preheader = "", headline, body, ctaText, ctaUrl, footerNote } = opts;

  // Bulletproof CTA — nested table; centers in Gmail mobile where plain <td align="center"> does not
  const ctaBlock = ctaText && ctaUrl ? `
    <tr>
      <td align="center" style="padding:24px 40px 8px;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation"
          style="border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td align="center" bgcolor="${C.buttonBg}"
              style="border-radius:8px;cursor:auto;mso-padding-alt:12px 28px;text-align:center;">
              <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
                style="display:inline-block;background:${C.buttonBg};border-radius:8px;color:${C.buttonText};font-family:${FONT};font-size:15px;font-weight:600;line-height:1.4;margin:0;text-decoration:none;padding:12px 28px;">
                ${ctaText}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : "";

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
<body style="margin:0;padding:0;word-spacing:normal;background-color:${C.bg};">

  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>` : ""}

  <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
    style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;width:100%;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table border="0" cellpadding="0" cellspacing="0" role="presentation"
          style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;width:100%;max-width:480px;background-color:${C.card};border-radius:12px;overflow:hidden;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:40px 40px 24px 40px;">
              <img src="${LOGO_URL}" alt="Brainerd Baptist Church" width="180"
                style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                <tr>
                  <td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <h1 style="margin:0;font-family:${FONT};font-size:22px;font-weight:700;line-height:1.3;color:${C.blue};letter-spacing:-0.01em;">
                ${headline}
              </h1>
            </td>
          </tr>

          <!-- Body (nested table for reliable padding across all email clients) -->
          <tr>
            <td style="padding:12px 0 0 0;">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                <tr>
                  <td style="padding:0 40px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body};">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${ctaBlock}
          <tr><td style="height:8px;"></td></tr>

          <!-- Divider above footer -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                <tr>
                  <td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature / footer -->
          <tr>
            <td style="padding:20px 40px 0 40px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.body};">
              <p style="margin:0;">— The BX Team<br />Brainerd Baptist Church</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 40px 40px 40px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.light};">
              <p style="margin:0;">
                ${footerNote ? `${footerNote} &middot; ` : ""}Questions? Call or text
                <a href="tel:4236534670" style="color:${C.light};text-decoration:underline;">(423) 653-4670</a>
.
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
  eventName:     string;
  dates:         string[];
  rooms:         string[];
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping confirmation");
    return;
  }
  const { to, name, bookingNumber, eventName, dates, rooms } = opts;

  const html = brandedEmailHtml({
    preheader: `Your booking reference is ${bookingNumber} — we'll be in touch shortly.`,
    headline: "We received your reservation request.",
    body: `
      <p style="margin:0 0 16px 0;">Hi ${name},</p>
      <p style="margin:0 0 16px 0;">Thank you for submitting a space reservation request at Brainerd Baptist Church.
         Here's a summary of what we received:</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%;border-collapse:collapse;margin:16px 0 8px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;width:38%;">Booking #</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#00205b;font-size:14px;font-weight:700;">${bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Event</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Date(s)</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${dates.length ? dates.join(", ") : "See request"}</td>
        </tr>
        ${rooms.length > 0 ? `<tr>
          <td style="padding:10px 0;font-weight:600;color:#374151;font-size:14px;">Space(s)</td>
          <td style="padding:10px 0;color:#374151;font-size:14px;">${rooms.join(", ")}</td>
        </tr>` : ""}
      </table>
      <p style="margin:16px 0 0 0;">Our team will review your request and follow up within 2–3 business days.
         You'll receive an email when your status changes.</p>`,
    ctaText: "View Your Request",
    ctaUrl:  `${SITE_URL}/reservations`,
    footerNote: `Reference: ${bookingNumber}`,
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
    headline: "New Reservation Request",
    body: `
      <p style="margin:0 0 16px 0;">A new space reservation request has been submitted and is waiting for review.</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%;border-collapse:collapse;margin:16px 0 8px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;width:38%;">Booking #</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#00205b;font-size:14px;font-weight:700;">${bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Submitted by</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${submitterName} &lt;${submitterEmail}&gt;</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Event</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;${(rooms.length > 0 || notes) ? "border-bottom:1px solid #e5e7eb;" : ""}font-weight:600;color:#374151;font-size:14px;">Date(s)</td>
          <td style="padding:10px 0;${(rooms.length > 0 || notes) ? "border-bottom:1px solid #e5e7eb;" : ""}color:#374151;font-size:14px;">${dates.length ? dates.join(", ") : "TBD"}</td>
        </tr>
        ${rooms.length > 0 ? `<tr>
          <td style="padding:10px 0;${notes ? "border-bottom:1px solid #e5e7eb;" : ""}font-weight:600;color:#374151;font-size:14px;">Space(s)</td>
          <td style="padding:10px 0;${notes ? "border-bottom:1px solid #e5e7eb;" : ""}color:#374151;font-size:14px;">${rooms.join(", ")}</td>
        </tr>` : ""}
        ${notes ? `<tr>
          <td style="padding:10px 0;font-weight:600;color:#374151;font-size:14px;vertical-align:top;">Notes</td>
          <td style="padding:10px 0;color:#374151;font-size:14px;">${notes}</td>
        </tr>` : ""}
      </table>`,
    ctaText: "Review in Admin Dashboard",
    ctaUrl:  `${SITE_URL}/admin/bx-reservations`,
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
  to:           string;
  inviterName:  string;
  eventName:    string;
  role:         "co_owner" | "viewer";
  acceptUrl:    string;
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
    headline: "You've been invited to collaborate.",
    body: `
      <p style="margin:0 0 16px 0;">${inviterName} has invited you to collaborate on a space reservation for
         <strong>${eventName}</strong>.</p>
      <p style="margin:0 0 16px 0;">Your access level will be <strong>${roleLabel}</strong> — ${roleDesc}.</p>
      <p style="margin:0 0 16px 0;">Click below to accept the invitation. This link expires in 7 days.</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you don't recognize this invitation, you can safely ignore this email.
      </p>`,
    ctaText: "Accept Invitation",
    ctaUrl:  acceptUrl,
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
  eventName:     string;
  newStatus:     "approved" | "declined" | "needs_info" | "cancelled" | "proposal_sent";
  adminNote?:    string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping status update");
    return;
  }
  const { to, name, bookingNumber, eventName, newStatus, adminNote } = opts;
  const noteBlock = adminNote
    ? `<p style="background:#f8fafc;border-left:3px solid #00abc9;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;color:#374151;font-size:14px;">
         <strong>Note from staff:</strong> ${adminNote}
       </p>`
    : "";

  const configs = {
    proposal_sent: {
      subject:  `Your BX Reservation — Proposal Ready · ${bookingNumber}`,
      headline: "We've reviewed your request.",
      body:     `<p style="margin:0 0 16px 0;">Hi ${name},</p><p style="margin:0 0 16px 0;">We've reviewed your space reservation for <strong>${eventName}</strong> (${bookingNumber}). Our team has prepared a proposal and will be reaching out shortly to confirm the next steps.</p>${noteBlock}<p style="margin:0;">Log in to view your reservation details and current status.</p>`,
      cta:      "View Your Request",
    },
    approved: {
      subject:  `Reservation Approved — ${bookingNumber}`,
      headline: "Your reservation has been approved.",
      body:     `<p style="margin:0 0 16px 0;">Hi ${name},</p><p style="margin:0 0 16px 0;">Great news — your space reservation for <strong>${eventName}</strong> (${bookingNumber}) has been approved.</p>${noteBlock}<p style="margin:0;">Please log in to view the full details of your approved reservation.</p>`,
      cta:      "View Approved Reservation",
    },
    declined: {
      subject:  `Reservation Update — ${bookingNumber}`,
      headline: "Your request could not be approved.",
      body:     `<p style="margin:0 0 16px 0;">Hi ${name},</p><p style="margin:0 0 16px 0;">After review, we're unable to approve your space reservation for <strong>${eventName}</strong> (${bookingNumber}) at this time.</p>${noteBlock}<p style="margin:0;">If you have questions or would like to submit a revised request, please contact the church office.</p>`,
      cta:      "View Request Details",
    },
    needs_info: {
      subject:  `Action Needed — ${bookingNumber}`,
      headline: "Additional information needed.",
      body:     `<p style="margin:0 0 16px 0;">Hi ${name},</p><p style="margin:0 0 16px 0;">We're reviewing your reservation for <strong>${eventName}</strong> (${bookingNumber}) and have a few follow-up questions before we can proceed.</p>${noteBlock}<p style="margin:0;">Please log in to view the details and respond.</p>`,
      cta:      "View & Respond",
    },
    cancelled: {
      subject:  `Reservation Cancelled — ${bookingNumber}`,
      headline: "Your reservation has been cancelled.",
      body:     `<p style="margin:0 0 16px 0;">Hi ${name},</p><p style="margin:0 0 16px 0;">Your space reservation for <strong>${eventName}</strong> (${bookingNumber}) has been cancelled.</p>${noteBlock}<p style="margin:0;">If you believe this was an error, please contact the church office.</p>`,
      cta:      "View Reservation",
    },
  } as const;

  const cfg = configs[newStatus];

  const html = brandedEmailHtml({
    preheader: cfg.subject,
    headline:  cfg.headline,
    body:      cfg.body,
    ctaText:   cfg.cta,
    ctaUrl:    `${SITE_URL}/reservations`,
    footerNote: `Reference: ${bookingNumber}`,
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
  eventName:     string;
  firstDate:     string;   // e.g. "Monday, September 28, 2026"
  startTime:     string;   // e.g. "8:00 AM"
  endTime:       string;   // e.g. "10:00 PM"
  rooms:         string[];
  headcount:     number;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping reminder");
    return;
  }
  const { to, name, bookingNumber, eventName, firstDate, startTime, endTime, rooms, headcount } = opts;

  const html = brandedEmailHtml({
    preheader: `Your event "${eventName}" is coming up in 48 hours — here's everything you need.`,
    headline:  "Your booking is coming up.",
    body: `
      <p style="margin:0 0 16px 0;">Hi ${name},</p>
      <p style="margin:0 0 16px 0;">This is a reminder that your space reservation at Brainerd Baptist Church is
         <strong>48 hours away</strong>. Here's a quick summary:</p>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"
        style="width:100%;border-collapse:collapse;margin:16px 0 8px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;width:38%;">Booking #</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#00205b;font-size:14px;font-weight:700;">${bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Event</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Date</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${firstDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Time</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${startTime} – ${endTime}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:14px;">Space(s)</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${rooms.join(", ")}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-weight:600;color:#374151;font-size:14px;">Headcount</td>
          <td style="padding:10px 0;color:#374151;font-size:14px;">${headcount} attendees</td>
        </tr>
      </table>
      <p style="margin:16px 0 0 0;">If you have any questions or need to make last-minute changes,
         please contact the church office as soon as possible.</p>`,
    ctaText:    "View Your Booking",
    ctaUrl:     `${SITE_URL}/reservations`,
    footerNote: `Reference: ${bookingNumber}`,
  });

  await getResend().emails.send({
    from:    FROM,
    to,
    subject: `Reminder: "${eventName}" is in 48 hours — ${bookingNumber}`,
    html,
  });
}
