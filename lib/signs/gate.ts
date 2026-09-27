// When door signs may be generated (shared by the API route and the reservation page).
// Client-safe: no server imports.

const UNLOCKED = new Set(["approved", "confirmed", "completed"]);

export function signsUnlocked(
  r: { status: string; logo_status?: string | null },
  staff: boolean
): { ok: boolean; why?: string } {
  if (staff) return { ok: true };
  if (!UNLOCKED.has(r.status)) return { ok: false, why: "Door signs unlock once your reservation is approved." };
  if (r.logo_status === "pending") return { ok: false, why: "Your logo is waiting for review — signs unlock as soon as it's approved." };
  if (r.logo_status === "rejected") return { ok: false, why: "Upload a different logo (or remove it) to unlock your signs." };
  return { ok: true };
}

/** The share link follows the same rule as signs, minus the logo: approved reservations, or staff. */
export function shareUnlocked(r: { status: string }, staff: boolean): { ok: boolean; why?: string } {
  if (staff) return { ok: true };
  if (!UNLOCKED.has(r.status)) return { ok: false, why: "The share link unlocks once your reservation is approved." };
  return { ok: true };
}
