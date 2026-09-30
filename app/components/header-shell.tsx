"use client";

import { useState, useEffect } from "react";
import { can, type BxRole } from "@/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginHref } from "@/lib/return-path";
import Image from "next/image";
import NavSidebar from "./nav-sidebar";
import ProfileMenu from "./profile-menu";
import dynamic from "next/dynamic";

// Loaded only for signed-in people, so visitors don't download the live
// notification library (~235 KB) on every page (C2).
const NotificationBell = dynamic(() => import("./notification-bell"), {
  ssr: false,
  loading: () => <span aria-hidden="true" style={{ display: "inline-block", width: 40, height: 40 }} />,
});

interface HeaderShellProps {
  initials: string;
  role: BxRole | null;
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
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        className={`bx-header z-40 print:hidden fixed top-0 left-0 right-0 w-full border-b${scrolled ? " bx-scrolled" : ""}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              aria-haspopup="dialog"
              className="p-2.5 rounded-lg transition-colors -ml-2.5 inline-flex items-center justify-center min-w-11 min-h-11"
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
                className="h-8 sm:h-9 w-auto object-contain bbc-logo"
                priority
              />
            </Link>
          </div>

          {/* Right: new request + avatar/sign-in */}
          <div className="flex items-center gap-3">
            {hasUser && (
              <NotificationBell />
            )}

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
                href={loginHref(pathname)}
                className="inline-flex items-center whitespace-nowrap min-h-10 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors border"
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
                Sign in<span className="max-[359px]:hidden"> / Sign up</span>
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
