"use client";

/** "Couldn't load X" with a Retry button — distinct from a genuinely empty list. */
export default function LoadError({
  what,
  message,
  onRetry,
}: {
  what: string;
  message?: string | null;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="bx-tone-red rounded-xl border p-4 flex items-start gap-3">
      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
      </svg>
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold">Couldn&apos;t load {what}.</p>
        {message && <p className="mt-0.5 opacity-90 break-words">{message}</p>}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-current px-3 py-1.5 text-xs font-semibold hover:opacity-80"
      >
        Retry
      </button>
    </div>
  );
}
