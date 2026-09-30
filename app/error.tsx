"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Page-level error screen: a calm message and two ways forward, never a blank page. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div role="alert" className="bx-glass animate-in rounded-2xl p-8 max-w-md w-full text-center">
        <p className="bx-eyebrow mb-4">Something went wrong</p>
        <h1 className="text-3xl font-semibold text-parchment mb-2">This page didn&apos;t load</h1>
        <p className="text-sm text-slate mb-6">
          It&apos;s on our side, not yours. Try again, or head back home. If it keeps happening, email{" "}
          <a className="text-brass font-semibold underline" href="mailto:barb@brainerdbaptist.org">barb@brainerdbaptist.org</a>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={reset} className="bx-btn bx-btn--primary bx-btn--md">Try again</button>
          <Link href="/" className="bx-btn bx-btn--secondary bx-btn--md">Go home</Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-slate font-mono">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
