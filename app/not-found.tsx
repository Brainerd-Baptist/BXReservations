import Link from "next/link";

export const metadata = { title: "Page not found · BX Reservations" };

/** 404 in the app's own look instead of the framework's bare black-and-white page. */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="bx-glass animate-in rounded-2xl p-8 max-w-md w-full text-center">
        <p className="bx-eyebrow mb-4">404</p>
        <h1 className="text-3xl font-semibold text-parchment mb-2">We can&apos;t find that page</h1>
        <p className="text-sm text-slate mb-6">
          The link may be old, or the reservation may belong to a different account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/reservations" className="bx-btn bx-btn--primary bx-btn--md">My Reservations</Link>
          <Link href="/" className="bx-btn bx-btn--secondary bx-btn--md">Go home</Link>
        </div>
      </div>
    </div>
  );
}
