import { randomBytes } from "crypto";

// Server-only: kept out of lib/agreements.ts so the public signing page doesn't
// ship Node's crypto library to the browser (C2: about 420 KB).
export function generateToken(): string {
  return randomBytes(24).toString("hex"); // 48-char hex, URL-safe
}

/** Create a Facility Use Agreement for a booking and return its signing token.
 *  Called directly by the admin status route (it used to call our own API over
 *  HTTP without the staff sign-in, which the API rightly refused). */
export async function createAgreement(
  db: import("@supabase/supabase-js").SupabaseClient,
  opts: { reservationId: string; summary: string; contactName: string },
): Promise<string> {
  const { buildAgreementText } = await import("@/lib/agreements");
  const token = generateToken();
  const { error } = await db.from("reservation_agreements").insert({
    reservation_id: opts.reservationId, token,
    agreement_text: buildAgreementText(opts.summary, opts.contactName),
    customer_name: null, customer_signed_at: null, customer_ip: null, staff_name: null, staff_signed_at: null,
  });
  if (error) throw new Error(error.message);
  return token;
}
