"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NavSidebar from "./components/nav-sidebar";

export default function SiteHeader() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <>
      {/* Suspense required because NavSidebar calls useSearchParams(),
          which Next.js App Router cannot statically pre-render without a
          boundary. The sidebar is always hidden on first paint anyway. */}
      <Suspense>
        <NavSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      </Suspense>

      <header className="border-b border-gray-200 bg-white z-30 print:hidden sticky top-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Left: hamburger + logo + label */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Hamburger */}
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Logo + divider + label */}
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/bx-logo.png"
                alt="BX Brainerd Crossroads"
                width={36}
                height={36}
                className="object-contain"
                priority
              />
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-px h-5 bg-gray-200" />
                <span className="text-xs uppercase tracking-[0.2em] text-gray-500 whitespace-nowrap">
                  Reservations
                </span>
              </div>
            </Link>
          </div>

          {/* Right: new request + sign in */}
          <div className="flex items-center gap-3">
            <Link
              href="/reserve"
              className="text-sm text-gray-500 hover:text-[#00205B] transition-colors hidden sm:inline"
            >
              New request
            </Link>

            {/* Sign in — Phase 2: replace with <UserAvatar /> when auth is live */}
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00205B] border border-[#00205B]/30 rounded-lg px-3 py-1.5 hover:bg-[#00205B]/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign in
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
