import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { SITE_URL } from "@/lib/site";
import { safeNext } from "@/lib/return-path";
import { GOOGLE_CLIENT_ID, sha256hex, COOKIE_FLOW, flowCookie } from "@/lib/google-signin";

// Starts Google sign-in on our own address. ?next= is where to land afterwards (same-site paths only).
export async function GET(request: Request) {
  const here = new URL(request.url);
  // Keep the whole flow on one host so the sign-in cookie comes back with Google's reply.
  if (here.origin !== new URL(SITE_URL).origin) {
    return NextResponse.redirect(`${SITE_URL}/auth/google/start${here.search}`);
  }
  const clientId = GOOGLE_CLIENT_ID();
  if (!clientId) return NextResponse.redirect(`${SITE_URL}/login?error=oauth`);

  const next = safeNext(here.searchParams.get("next")) ?? "/account";
  const nonce = randomBytes(24).toString("hex");
  const state = randomBytes(24).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${SITE_URL}/auth/google/callback`);
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("nonce", sha256hex(nonce));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url.toString());
  // One cookie carries nonce, state and destination (nonce and state are hex, so "." splits cleanly).
  res.cookies.set(COOKIE_FLOW, `${nonce}.${state}.${encodeURIComponent(next)}`, flowCookie);
  return res;
}
