import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Continue · BX Reservations" };

const COPY: Record<string, { title: string; body: string; cta: string }> = {
  recovery: { title: "Reset your password", body: "Tap continue to choose a new password.", cta: "Continue" },
  signup:   { title: "Confirm your email",  body: "Tap continue to confirm your email and finish setting up your account.", cta: "Confirm email" },
  email:    { title: "Confirm your email",  body: "Tap continue to confirm your email and finish setting up your account.", cta: "Confirm email" },
  invite:   { title: "You're invited",      body: "Tap continue to accept your invitation to BX Reservations.", cta: "Accept invitation" },
  magiclink:{ title: "Sign in",             body: "Tap continue to sign in.", cta: "Sign in" },
};

const ERRORS: Record<string, string> = {
  expired: "This link has expired or was already used. Request a new one from the sign-in page.",
  missing: "This link is incomplete. Open it straight from the email, or request a new one.",
};

/**
 * Landing page for links in our auth emails. The one-time token is only used
 * when the person taps the button (a form POST), so email security scanners
 * that open links ahead of time can't use it up.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const type = sp.type ?? "email";
  const copy = COPY[type] ?? COPY.email;
  const error = sp.error ? ERRORS[sp.error] ?? ERRORS.expired : !sp.token_hash ? ERRORS.missing : null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="rounded-2xl p-3 mb-3 flex items-center justify-center" style={{ background: "var(--bx-brass)" }}>
            <Image src="/bx-logo.png" alt="BX Community Center" width={48} height={48} className="object-contain" priority />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate mb-4">BX Reservations</p>
          <h1 className="text-xl font-bold text-parchment">{copy.title}</h1>
        </div>
        <div className="bx-glass rounded-2xl p-7 animate-in">
          {error ? (
            <div className="space-y-4 text-center">
              <p role="alert" className="text-sm" style={{ color: "var(--bx-clay)" }}>{error}</p>
              <Link href="/login" className="bx-btn bx-btn--primary bx-btn--md bx-btn--block">Back to sign in</Link>
            </div>
          ) : (
            <form method="post" action="/auth/confirm/verify" className="space-y-5">
              <input type="hidden" name="token_hash" value={sp.token_hash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={sp.next ?? ""} />
              <p className="text-sm text-slate text-center">{copy.body}</p>
              <button type="submit" className="bx-btn bx-btn--primary bx-btn--md bx-btn--block">{copy.cta}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
