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

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
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
