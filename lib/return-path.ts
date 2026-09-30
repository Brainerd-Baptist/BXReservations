/**
 * Where to send someone after they sign in (audit F12).
 *
 * Only same-site paths are allowed — "/reservations/123", never
 * "https://evil.example" or "//evil.example" (open-redirect protection) —
 * and never back into the sign-in flow itself.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  let v = value.trim();
  try {
    // Tolerate one level of encoding ("%2Freservations").
    if (/^%2f/i.test(v)) v = decodeURIComponent(v);
  } catch {
    return null;
  }
  if (v.length > 500) return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(v)) return null;
  if (/^\/(login|auth\/callback|api\/auth)(\/|\?|$)/.test(v)) return null;
  return v;
}

/** "/login?next=…" for a page someone needs to be signed in to see. */
export function loginHref(next: string | null | undefined): string {
  const safe = safeNext(next);
  return safe && safe !== "/" ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
