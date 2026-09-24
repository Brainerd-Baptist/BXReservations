import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { getUserAndRole } from "@/lib/get-user-role";
import NavSidebarWrapper from "./components/nav-sidebar-wrapper";

export default async function SiteHeader() {
  const { user, role } = await getUserAndRole();

  const initials = user
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
          <div className="flex items-center gap-3 shrink-0">
            {/* Hamburger is inside NavSidebarWrapper (client component) */}
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
                className="inline-flex items-center gap-2 text-sm font-medium text-[#00205B] border border-[#00205B]/30 rounded-lg px-3 py-1.5 hover:bg-[#00205B]/5 transition-colors"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: "#00205B" }}
                >
                  {initials || "?"}
                </span>
                <span className="hidden sm:inline">
                  {role === "admin" ? "Admin" : "My account"}
                </span>
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
