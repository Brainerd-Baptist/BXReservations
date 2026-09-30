"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BxMark from "@/app/components/bx-mark";

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
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8 flex flex-col items-center">
          <BxMark height={36} className="mb-5" />
          <h1 className="text-xl font-bold text-parchment">Set a new password</h1>
        </div>

        <div className="bx-glass rounded-2xl p-7 animate-in">

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
                className="bx-btn bx-btn--primary bx-btn--md bx-btn--block"
              >
                Back to sign in
              </button>
            </div>
          )}

          {sessionReady === true && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-pass-new-password-1" className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">New password</label>
                <input id="reset-pass-new-password-1"
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="bx-input"
                />
              </div>
              <div>
                <label htmlFor="reset-pass-confirm-password-2" className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Confirm password</label>
                <input id="reset-pass-confirm-password-2"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your new password"
                  className="bx-input"
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
                className="bx-btn bx-btn--primary bx-btn--md bx-btn--block"
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
