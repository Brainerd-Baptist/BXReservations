"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface NavSidebarProps {
  open: boolean;
  onClose: () => void;
}

// ─── Nav item definitions ──────────────────────────────────────────────────
// Structure mirrors the Personnel/Workspaces family: a top-level anchor,
// a Reservations section for the requester-facing flow, and an Admin
// section for staff. Sign in/account lives in the sidebar footer.
// Phase 2 will add auth-awareness so Admin items only render for staff.

const navItems = [
  { label: "Dashboard", href: "/", icon: "grid" },
];

const reservationItems = [
  { label: "New Request", href: "/reserve", icon: "plus" },
  { label: "My Reservations", href: "/account", icon: "list" },
];

const adminItems = [
  { label: "All Reservations", href: "/admin/bx-reservations", icon: "table" },
  { label: "Pending Review", href: "/admin/bx-reservations?status=under_review", icon: "clock" },
  { label: "Calendar", href: "/admin/bx-reservations/calendar", icon: "calendar" },
  { label: "COI Review", href: "/admin/bx-reservations/coi", icon: "shield" },
  { label: "Reports", href: "/admin/bx-reservations/reports", icon: "chart" },
  { label: "Settings", href: "/admin/bx-reservations/settings", icon: "settings" },
];

// ─── Icon set ─────────────────────────────────────────────────────────────

function Icon({ name, className }: { name: string; className?: string }) {
  const cls = `w-4 h-4 ${className ?? ""}`;
  if (name === "grid") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
  if (name === "plus") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
  if (name === "list") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
  if (name === "clock") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (name === "table") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m0 0h17.25m0 0c.621 0 1.125.504 1.125 1.125v1.5m-9.75-10.5h6m-6 4.5h6m-6 4.5h6m4.5-15h-15" />
    </svg>
  );
  if (name === "calendar") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
  if (name === "shield") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
  if (name === "chart") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
  if (name === "settings") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
  if (name === "login") return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
  return null;
}

// ─── NavLink ──────────────────────────────────────────────────────────────
// Handles both plain paths and paths with query params (e.g. ?status=…).
// Uses useSearchParams to check the full URL, not just pathname, so
// "Pending Review" and "All Reservations" don't both light up on the same
// page when one is a filtered subset of the other.

function NavLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Split off any query string from the href definition
  const [hrefPath, hrefQuery] = href.split("?");
  const currentQuery = searchParams.toString();

  let active: boolean;
  if (hrefQuery) {
    // Exact path + exact query must match for query-param links
    const hrefParams = new URLSearchParams(hrefQuery);
    active =
      pathname === hrefPath &&
      hrefParams.get("status") === searchParams.get("status");
  } else {
    // Plain links: exact match on "/", startsWith on everything else
    active =
      hrefPath === "/"
        ? pathname === "/"
        : pathname.startsWith(hrefPath) && !currentQuery;
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-[#00205B]/[0.08] text-[#00205B] font-medium"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <Icon name={icon} className={active ? "text-[#00205B]" : "text-gray-400"} />
      {label}
    </Link>
  );
}

// ─── NavSidebar ────────────────────────────────────────────────────────────

export default function NavSidebar({ open, onClose }: NavSidebarProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header row */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-400">
            BX Reservations
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav content */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">

          {/* Top-level */}
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} onClick={onClose} />
            ))}
          </div>

          {/* RESERVATIONS */}
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">
              Reservations
            </p>
            <div className="space-y-0.5">
              {reservationItems.map((item) => (
                <NavLink key={item.href} {...item} onClick={onClose} />
              ))}
            </div>
          </div>

          {/* ADMIN — Phase 2: render only when user has admin role */}
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">
              Admin
            </p>
            <div className="space-y-0.5">
              {adminItems.map((item) => (
                <NavLink key={item.href} {...item} onClick={onClose} />
              ))}
            </div>
          </div>
        </nav>

        {/* Footer — sign in prompt; Phase 2: swap for user avatar + sign out */}
        <div className="border-t border-gray-100 p-4 space-y-1">
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#00205B] hover:bg-[#00205B]/5 transition-colors"
          >
            <Icon name="login" className="text-[#00205B]" />
            Sign in
          </Link>
          <p className="px-3 text-[11px] text-gray-400 leading-snug">
            Sign in to save reservations and track your requests.
          </p>
        </div>
      </div>
    </>
  );
}
