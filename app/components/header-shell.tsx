"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NavSidebar from "./nav-sidebar";
import ProfileMenu from "./profile-menu";

interface HeaderShellProps {
  initials: string;
  role: "admin" | "user" | null;
  hasUser: boolean;
  userId?: string;
  email?: string;
  displayName?: string | null;
  savedTheme?: string | null;
}

export default function HeaderShell({
  initials,
  role,
  hasUser,
  userId,
  email,
  displayName,
  savedTheme,
}: HeaderShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <NavSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        hasUser={hasUser}
        displayName={displayName ?? null}
        email={email ?? null}
      />

      <header
        className="z-30 print:hidden sticky top-0 border-b"
        style={{
          background: "var(--bx-ink-soft)",
          borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="p-1.5 rounded-lg transition-colors -ml-1"
              style={{ color: "var(--bx-slate)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "color-mix(in srgb, var(--bx-parchment) 8%, transparent)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2 group ml-1">
              {/* BBC stacked logo — white PNG, renders directly on dark header */}
              <Image
                src="/bbc-logo-stacked.png"
                alt="Brainerd Baptist Church"
                width={130}
                height={38}
                className="h-8 sm:h-9 w-auto object-contain"
                priority
              />
              <div className="flex items-center gap-2 ml-1">
                <div
                  className="w-px h-4"
                  style={{ background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }}
                />
                <span
                  className="text-[10px] uppercase tracking-[0.2em] whitespace-nowrap font-medium"
                  style={{ color: "color-mix(in srgb, var(--bx-slate) 70%, transparent)" }}
                >
                  Reservations
                </span>
              </div>
            </Link>
          </div>

          {/* Right: new request + avatar/sign-in */}
          <div className="flex items-center gap-3">
            <Link
              href="/reserve"
              className="text-sm transition-colors hidden sm:inline"
              style={{ color: "var(--bx-slate)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "var(--bx-parchment)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "var(--bx-slate)")
              }
            >
              New request
            </Link>

            {hasUser && userId && email ? (
              <ProfileMenu
                userId={userId}
                initials={initials}
                role={role}
                email={email}
                displayName={displayName ?? null}
                savedTheme={savedTheme}
              />
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center text-sm font-medium rounded-lg px-3 py-1.5 transition-colors border"
                style={{
                  color: "var(--bx-parchment)",
                  borderColor: "color-mix(in srgb, var(--bx-parchment) 30%, transparent)",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background =
                    "color-mix(in srgb, var(--bx-parchment) 5%, transparent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
                }
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
