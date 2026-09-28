"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    // The auth callback already exchanged the code and set a recovery session.
    // We just need to confirm we have a valid session here.
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/account"), 2500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ink">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8 flex flex-col items-center">
          <div className="rounded-2xl p-3 mb-3 flex items-center justify-center" style={{ background: "var(--bx-brass)" }}>
            <Image src="/bx-logo.png" alt="BX Community Center" width={48} height={48} className="object-contain" priority />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate mb-4">BX Reservations</p>
          <h1 className="text-xl font-bold text-parchment">Set a new password</h1>
        </div>

        <div className="bg-ink-soft border border-parchment/10 rounded-xl p-7 shadow-sm">

          {sessionReady === null && (
            <p className="text-sm text-slate text-center py-4">Verifying reset link…</p>
          )}

          {sessionReady === false && (
            <div className="text-center space-y-4">
              <p className="text-sm text-red-400">
                This reset link has expired or already been used. Please request a new one.
              </p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full bg-brass hover:bg-brass/90 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                Back to sign in
              </button>
            </div>
          )}

          {sessionReady === true && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full border border-parchment/20 rounded-lg py-2.5 px-3 text-sm text-parchment placeholder:text-slate/50 bg-ink focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Confirm password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your new password"
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
                className="w-full bg-brass hover:bg-brass/90 active:scale-[0.98] transition-all text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-60"
              >
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}

          {done && (
            <div className="text-center space-y-3 py-2">
              <div className="text-[var(--bx-sage)] text-3xl">✓</div>
              <p className="text-parchment font-semibold">Password updated!</p>
              <p className="text-sm text-slate">Taking you to your account…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
