// What a booking doesn't need (church use): agreement, insurance, payment.
export interface Waived { agreement: boolean; coi: boolean; payment: boolean }
export function readWaived(v: unknown): Waived {
  const w = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { agreement: w.agreement === true, coi: w.coi === true, payment: w.payment === true };
}
export const WAIVER_LABEL: Record<keyof Waived, string> = {
  agreement: "Facility Use Agreement",
  coi: "Certificate of Insurance",
  payment: "Payment",
};
