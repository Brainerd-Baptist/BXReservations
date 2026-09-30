// One place for the site's public address and contact details (C2).
// Change the help email here and it changes everywhere (site, emails, PDFs).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://bx.brainerdhq.app").replace(/\/$/, "");
export const SUPPORT_EMAIL = "BXreservations@brainerdbaptist.org";
export const SUPPORT_PHONE = "(423) 643-4978";
export const SUPPORT_PHONE_TEL = "4236434978";
/** Staff alert emails go to the shared BX inbox (every staff member also gets
 *  an in-app notification). Set ADMIN_EMAIL in Vercel to send them elsewhere. */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? SUPPORT_EMAIL;
