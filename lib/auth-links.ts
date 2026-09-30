import { safeNext } from "@/lib/return-path";

/**
 * Links in our own auth emails (confirm, reset, invite).
 *
 * We don't send Supabase's `action_link`: it signs people in by putting
 * tokens in the URL #hash, which this app's server-side sign-in never sees —
 * so reset links looked "expired" and new email accounts never got set up.
 * Instead we send the one-time `hashed_token` to /auth/confirm, which verifies
 * it on the server (and only when the person taps Continue, so email link
 * scanners can't use it up first).
 */
export function authEmailLink(
  props: { hashed_token?: string; verification_type?: string } | null | undefined,
  next: string,
  fallbackType: "signup" | "recovery" | "invite" | "magiclink" | "email",
): string | null {
  if (!props?.hashed_token) return null;
  const site = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app";
  const u = new URL("/auth/confirm", site);
  u.searchParams.set("token_hash", props.hashed_token);
  u.searchParams.set("type", props.verification_type || fallbackType);
  u.searchParams.set("next", safeNext(next) ?? "/reservations");
  return u.toString();
}
