"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NavSidebar from "./nav-sidebar";

interface HeaderShellProps {
  initials: string;
  role: "admin" | "user" | null;
  hasUser: boolean;
}

export default function HeaderShell({ initials, role, hasUser }: HeaderShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <NavSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="border-b border-gray-200 bg-white z-30 print:hidden sticky top-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors -ml-1"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2 group ml-1">
              <Image
                src="/bx-logo.png"
                alt="BX Brainerd Crossroads"
                width={30}
                height={30}
                className="object-contain"
                priority
              />
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-px h-4 bg-gray-200" />
                <span className="text-[11px] uppercase tracking-[0.18em] text-gray-400 whitespace-nowrap font-medium">
                  Reservations
                </span>
              </div>
            </Link>
          </div>

          {/* Right: new request + avatar */}
          <div className="flex items-center gap-3">
            <Link
              href="/reserve"
              className="text-sm text-gray-500 hover:text-[#00205B] transition-colors hidden sm:inline"
            >
              New request
            </Link>

            {hasUser ? (
              <Link
                href="/account"
                title={role === "admin" ? "Admin" : "My account"}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 hover:opacity-85 transition-opacity"
                style={{ background: "#00205B" }}
              >
                {initials || "?"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center text-sm font-medium text-[#00205B] border border-[#00205B]/30 rounded-lg px-3 py-1.5 hover:bg-[#00205B]/5 transition-colors"
              >
                Sign in / Sign up
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
