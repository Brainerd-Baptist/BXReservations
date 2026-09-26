"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/account");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });
    setResetLoading(false);
    setResetSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ink">
      <div className="w-full max-w-sm">

        {/* Logo + label */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Image
            src="/bx-logo.png"
            alt="BX Community Center"
            width={56}
            height={56}
            className="object-contain mb-3"
            priority
          />
          <p className="text-xs uppercase tracking-[0.3em] text-slate mb-4">
            BX Reservations
          </p>
          <h1 className="text-xl font-bold text-parchment">Sign in or create an account</h1>
          <p className="text-sm text-slate mt-1.5 max-w-xs leading-relaxed">
            New here? Your Google account doubles as your BX Reservations account — no sign-up form needed.
          </p>
        </div>

        <div className="bg-ink-soft border border-parchment/10 rounded-xl p-7 shadow-sm space-y-5">

          {/* Google — primary CTA */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-ink-soft border border-parchment/20 hover:border-parchment/40 hover:bg-parchment/5 active:scale-[0.98] transition-all text-parchment font-medium rounded-lg py-3 text-sm disabled:opacity-60 shadow-sm"
          >
            <GoogleIcon size={16} />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Google hint */}
          <div className="flex items-start gap-2 bg-brass/5 border border-brass/20 rounded-lg px-3 py-2.5">
            <span className="text-brass text-base leading-none mt-0.5">ℹ</span>
            <p className="text-xs text-slate leading-relaxed">
              Use the Google button to <strong>sign in or create a new account</strong>. First-time users are set up automatically.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-parchment/10" />
            <span className="text-[10px] uppercase tracking-wide text-slate">or sign in with email</span>
            <div className="flex-1 h-px bg-parchment/10" />
          </div>

          {/* Email + password fallback */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">
                Email
              </label>
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
              <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">
                Password
              </label>
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
              className="w-full bg-brass hover:bg-brass/90 active:scale-[0.98] transition-all text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-xs text-slate text-center mt-5 leading-relaxed px-2">
          By continuing, you agree to our use of your information to manage your reservation requests.
        </p>

        {/* Forgot-password overlay */}
        {forgotMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/80 backdrop-blur-sm" onClick={() => setForgotMode(false)}>
            <div className="w-full max-w-sm bg-ink-soft border border-parchment/15 rounded-xl p-7 shadow-xl" onClick={(e) => e.stopPropagation()}>
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div style={{color:"var(--bx-ink)"}}><svg width="1.75rem" height="1.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{display:"block"}}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg></div>
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
