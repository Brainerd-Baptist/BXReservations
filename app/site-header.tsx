import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { getUserAndRole } from "@/lib/get-user-role";
import NavSidebarWrapper from "./components/nav-sidebar-wrapper";

export default async function SiteHeader() {
  const { user, role, profile } = await getUserAndRole();

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user
    ? user.email
        .split("@")[0]
        .split(/[._-]/)
        .map((p: string) => p[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("")
    : "";

  return (
    <>
      <Suspense>
        <NavSidebarWrapper />
      </Suspense>
      <header className="border-b border-gray-200 bg-white z-30 print:hidden sticky top-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Hamburger rendered inside NavSidebarWrapper */}
            <Link href="/" className="flex items-center gap-2.5 group ml-1">
              <Image
                src="/bx-logo.png"
                alt="BX Brainerd Crossroads"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
              <div className="hidden sm:flex items-center gap-2.5">
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

            {user ? (
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
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00205B] border border-[#00205B]/30 rounded-lg px-3 py-1.5 hover:bg-[#00205B]/5 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
