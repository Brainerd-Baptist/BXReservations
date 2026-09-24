"use client";

import Link from "next/link";
import Image from "next/image";

export default function SiteHeader() {
  return (
    <header className="border-b border-gray-200 bg-white z-30 print:hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: BX logo + label */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <Image
            src="/bx-logo.png"
            alt="BX Brainerd Crossroads"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-xs uppercase tracking-[0.18em] text-gray-500 whitespace-nowrap font-medium group-hover:text-[#00205B] transition-colors">
              Reservations
            </span>
          </div>
        </Link>

        {/* Right: nav + sign in */}
        <div className="flex items-center gap-3">
          <Link
            href="/reserve"
            className="text-sm text-gray-500 hover:text-[#00205B] transition-colors hidden sm:inline"
          >
            New request
          </Link>
          {/* Sign in — Phase 2 will replace with user avatar/menu */}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00205B] border border-[#00205B]/30 rounded-lg px-3 py-1.5 hover:bg-[#00205B]/5 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
