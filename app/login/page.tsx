"use client";

import { safeNext } from "@/lib/return-path";
import { useState, useRef, useCallback } from "react";
import BodyPortal from "@/app/components/body-portal";
import { useModalDialog } from "@/app/components/use-modal-dialog";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

type Mode = "signin" | "signup" | "confirm_sent";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState("");

  // Forgot-password state
  const [forgotMode, setForgotMode] = useState(false);
  const forgotRef = useRef<HTMLDivElement>(null);
  const closeForgot = useCallback(() => setForgotMode(false), []);
  useModalDialog(forgotMode, closeForgot, forgotRef);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Where to go after signing in: ?next= (or legacy ?redirect=), validated
  // to a same-site path. Defaults to Account (audit F12).
  function destination(): string {
    if (typeof window === "undefined") return "/account";
    const q = new URLSearchParams(window.location.search);
    return safeNext(q.get("next")) ?? safeNext(q.get("redirect")) ?? "/account";
  }
  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination())}`;

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setError("");
    setPassword("");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        setConfirmEmail(email);
        setMode("confirm_sent");
        return;
      }
      setError(signInError.message);
      return;
    }
    router.push(destination());
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: [name.trim(), lastName.trim()].filter(Boolean).join(" "), redirectTo: callbackUrl() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (data.error === "already_exists" || res.status === 409) {
        setError("An account with this email already exists. Try signing in, or use \"Forgot password\" if you need to reset it.");
        return;
      }
      setError(data.error ?? "Sign up failed. Please try again.");
      return;
    }
    setConfirmEmail(email);
    setMode("confirm_sent");
  }

  async function handleResend() {
    setResendLoading(true);
    setResendSent(false);
    setResendError("");
    // Only say "sent" when the server says so (it used to report success on failure)
    const ok = await fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: confirmEmail, redirectTo: callbackUrl() }),
    }).then((r) => r.ok, () => false);
    setResendLoading(false);
    if (ok) setResendSent(true);
    else setResendError("We couldn't send another email just now. Please try again in a minute.");
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetError("");
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const ok = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail.trim(), redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password` }),
    }).then((r) => r.ok, () => false);
    setResetLoading(false);
    if (ok) setResetSent(true);
    else setResetError("We couldn't send the reset email just now. Please try again in a minute.");
  }

  // ── Confirm-sent state ────────────────────────────────────────────────────
  if (mode === "confirm_sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "var(--bx-brass)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" /></svg>
          </div>
          <h1 className="text-xl font-bold text-parchment">Check your email</h1>
          <p className="text-sm text-slate leading-relaxed">
            We sent a confirmation link to <strong className="text-parchment">{confirmEmail}</strong>. Click it to activate your account, then come back here to sign in.
          </p>
          <p className="text-xs text-slate leading-relaxed">Didn&apos;t get it? Check your spam folder.</p>
          {resendError && <p role="alert" className="text-xs text-[var(--bx-clay)]">{resendError}</p>}
          {resendSent ? (
            <p className="text-xs text-[var(--bx-sage)]">Another confirmation email was sent!</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="text-xs text-brass hover:underline disabled:opacity-50"
            >
              {resendLoading ? "Sending…" : "Resend confirmation email"}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); }}
            className="bx-cta block w-full bg-brass text-white font-semibold rounded-lg py-2.5 text-sm"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo + label */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="bx-cta rounded-2xl p-3 mb-4 flex items-center justify-center" style={{ background: "var(--bx-brass)" }}>
            <Image
              src="/bx-logo.png"
              alt="BX Community Center"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <p className="bx-eyebrow mb-4">
            BX Reservations
          </p>
          <h1 className="text-3xl font-bold text-parchment">
            {mode === "signup" ? "Create an account" : "Sign in to BX"}
          </h1>
          <p className="text-sm text-slate mt-1.5 max-w-xs leading-relaxed">
            {mode === "signup"
              ? "Use your work or personal email to create an account."
              : "Sign in with Google or your email and password."}
          </p>
        </div>

        <div className="bx-glass rounded-2xl p-7 space-y-5 animate-in">

          {/* Google — primary CTA */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-[var(--bx-surface-strong)] border border-parchment/20 hover:border-parchment/40 hover:bg-parchment/5 shadow-sm active:scale-[0.98] transition-all text-parchment font-medium rounded-lg py-3 text-sm disabled:opacity-60 shadow-sm"
          >
            <GoogleIcon size={16} />
            {googleLoading ? "Redirecting…" : mode === "signup" ? "Sign up with Google" : "Continue with Google"}
          </button>

          {/* Google hint — sign-in mode only */}
          {mode === "signin" && (
            <div className="flex items-start gap-2 bg-brass/5 border border-brass/20 rounded-lg px-3 py-2.5">
              <span className="text-brass text-base leading-none mt-0.5">ℹ</span>
              <p className="text-xs text-slate leading-relaxed">
                Use the Google button to <strong>sign in or create a new account</strong>. First-time users are set up automatically.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-parchment/10" />
            <span className="text-[10px] uppercase tracking-wide text-slate">
              or {mode === "signup" ? "sign up" : "sign in"} with email
            </span>
            <div className="flex-1 h-px bg-parchment/10" />
          </div>

          {/* Sign-up form */}
          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">First name</label>
                  <input
                    type="text"
                    required
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="First"
                    className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Last name</label>
                  <input
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                    className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                />
              </div>
              {error && (
                <div className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="bx-cta w-full bg-brass text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-60 active:scale-[0.98]"
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
              <p className="text-center text-xs text-slate">
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("signin")} className="text-brass hover:underline font-semibold">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Sign-in form */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setResetEmail(email); setError(""); }}
                  className="text-xs text-slate hover:text-brass transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="space-y-2">
                  <div className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                    {error}
                  </div>
                  {error.toLowerCase().includes("invalid login credentials") && (
                    <p className="text-xs text-slate leading-relaxed px-1">
                      Previously signed in with Google? Use the <strong>Continue with Google</strong> button above.
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="bx-cta w-full bg-brass text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-60 active:scale-[0.98]"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>

              <p className="text-center text-xs text-slate">
                Don&apos;t have an account?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="text-brass hover:underline font-semibold">
                  Create one
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-xs text-slate text-center mt-5 leading-relaxed px-2">
          By continuing, you agree to our use of your information to manage your reservation requests.
        </p>

        {/* Forgot-password overlay */}
        {forgotMode && (
          <BodyPortal>
          <div
            ref={forgotRef}
            role="dialog"
            aria-modal="true"
            aria-label="Reset your password"
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/80 backdrop-blur-sm"
            onClick={() => setForgotMode(false)}
          >
            <div className="w-full max-w-sm bx-glass-strong rounded-2xl p-7" onClick={(e) => e.stopPropagation()}>
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div style={{color:"var(--bx-brass)"}}><svg width="1.75rem" height="1.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{display:"block"}}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg></div>
                  <h2 className="text-lg font-bold text-parchment">Check your email</h2>
                  <p className="text-sm text-slate leading-relaxed">
                    If <strong>{resetEmail}</strong> has an account, we sent a password reset link. Check your inbox (and spam folder).
                  </p>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setResetSent(false); }}
                    className="w-full bg-brass hover:bg-brass/90 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-parchment mb-1">Reset your password</h2>
                  <p className="text-sm text-slate mb-5 leading-relaxed">Enter the email address on your account and we&apos;ll send a reset link.</p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <input
                      type="email"
                      required
                      autoFocus
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                    />
                    {resetError && <p role="alert" className="text-xs text-[var(--bx-clay)]">{resetError}</p>}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setForgotMode(false)}
                        className="flex-1 border border-parchment/20 text-slate font-medium rounded-lg py-2.5 text-sm hover:border-parchment/40 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="flex-1 bg-brass hover:bg-brass/90 text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-60 transition-colors"
                      >
                        {resetLoading ? "Sending…" : "Send reset link"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
          </BodyPortal>
        )}
      </div>
    </div>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
