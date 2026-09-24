"use client";

import Link from "next/link";

// BBC logo mark — inline SVG so no external asset needed.
// Matches the branding used across Brainerd Workspaces / Personnel Dashboard.
function BBCLogo({ height = 32 }: { height?: number }) {
  // Aspect ratio of the BBC wordmark: ~3.5:1
  const width = Math.round(height * 3.5);
  return (
    <svg
      height={height}
      width={width}
      viewBox="0 0 140 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Brainerd Baptist Church"
    >
      {/* Navy background pill */}
      <rect width="140" height="40" rx="6" fill="#00205B" />
      {/* "BBC" letters in teal */}
      <text
        x="70"
        y="28"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="4"
        fill="#00abc9"
      >
        BBC
      </text>
    </svg>
  );
}

export default function SiteHeader() {
  return (
    <header className="border-b border-gray-200 bg-white z-30 print:hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: logo + app name */}
        <div className="flex items-center gap-3 shrink-0">
          <BBCLogo height={28} />
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-xs uppercase tracking-[0.18em] text-gray-500 whitespace-nowrap font-medium">
              BX Reservations
            </span>
          </div>
        </div>

        {/* Right: Sign in (Phase 2 will replace with user menu) */}
        <div className="flex items-center gap-3">
          <Link
            href="/reserve"
            className="text-sm text-gray-500 hover:text-[#00205B] transition-colors hidden sm:inline"
          >
            New request
          </Link>
          {/* Sign in — placeholder until Phase 2 auth */}
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
  );
}
