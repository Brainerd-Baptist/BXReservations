// lib/agreements.ts — Agreement text, types, and token utilities

import { randomBytes } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgreementRecord {
  id: string;
  created_at: string;
  reservation_id: string;
  token: string;
  agreement_text: string;
  customer_name: string | null;
  customer_signed_at: string | null;
  customer_ip: string | null;
  staff_name: string | null;
  staff_signed_at: string | null;
}

export type AgreementStatus =
  | "pending_customer"   // agreement sent, customer hasn't signed yet
  | "pending_staff"      // customer signed, waiting for staff countersignature
  | "complete";          // both parties have signed

export function agreementStatus(a: AgreementRecord): AgreementStatus {
  if (!a.customer_signed_at) return "pending_customer";
  if (!a.staff_signed_at)    return "pending_staff";
  return "complete";
}

// ─── Token ───────────────────────────────────────────────────────────────────

export function generateToken(): string {
  return randomBytes(24).toString("hex"); // 48-char hex, URL-safe
}

// ─── Agreement text ──────────────────────────────────────────────────────────

/**
 * Generates the full agreement text for a given reservation.
 * The caller supplies a summary line (e.g. "Crossing — Oct 12, 2026, Morning").
 */
export function buildAgreementText(reservationSummary: string, contactName: string): string {
  return `BRAINERD CROSSING (BX) — FACILITY USE AGREEMENT

Reservation: ${reservationSummary}
Renter: ${contactName}

By signing below, both parties agree to the following terms:

1. GENERAL USE
   The BX facility is available for approved private and community events. Use is
   limited to the spaces, dates, and times specified in this agreement.

2. ALCOHOL & SUBSTANCES
   No alcohol, tobacco, or controlled substances are permitted on the premises at
   any time.

3. DECORATIONS
   Glitter, confetti, and open-flame candles are not permitted. Tape or adhesives
   must not damage walls, floors, or ceilings. All decorations must be removed by
   the end of the rental period.

4. CLEAN-UP
   The renter is responsible for leaving all spaces in the condition they were
   found. Tables, chairs, and AV equipment must be returned to their original
   positions. Trash must be bagged and placed in the designated bins.

5. PARKING
   Free parking is available in the BBC parking lots. Overflow parking is available
   across the street. Renters are responsible for notifying their guests.

6. AV & TECHNOLOGY
   The Crossing's production system (lights, sound, projection) is operated by
   BBC technical staff only. Renters requiring AV support must coordinate with the
   BX team in advance. Other rooms include basic AV at no charge.

7. CAPACITY & SAFETY
   Renters must not exceed the posted capacity for each room. Emergency exits must
   remain clear and accessible at all times.

8. DAMAGE & LIABILITY
   The renter assumes financial responsibility for any damage to the facility,
   equipment, or furnishings caused by the renter or their guests. BBC is not
   liable for personal injury or property loss during the rental period.

9. CANCELLATION
   Cancellations must be communicated to the BX team as soon as possible. Deposits
   (if applicable) are non-refundable within 48 hours of the event.

10. COMPLIANCE
    The renter agrees to comply with all BBC policies, applicable laws, and the
    reasonable direction of BBC staff during the rental period.

This agreement is entered into between Brainerd Baptist Church (BBC) and the
renter identified above.`;
}
