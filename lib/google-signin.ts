import { createHash } from "crypto";

// Direct Google sign-in (instead of Supabase's hosted flow), so Google's account picker says
// "to continue to brainerdhq.app" rather than showing the Supabase project address.
// Flow: /auth/google/start -> Google (OpenID, id_token returned by POST) -> /auth/google/callback,
// which hands the verified id_token to Supabase (signInWithIdToken). Nonce and state are checked.
export const GOOGLE_CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || "";
export const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
export const COOKIE_FLOW = "bx_g_flow";
// The cookie must survive Google's cross-site POST back to us: SameSite=None, Secure, short-lived.
export const flowCookie = { httpOnly: true, secure: true, sameSite: "none" as const, path: "/auth/google", maxAge: 600 };
