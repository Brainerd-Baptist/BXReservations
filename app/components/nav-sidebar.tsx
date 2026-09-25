"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface NavSidebarProps {
  open: boolean;
  onClose: () => void;
  role: "admin" | "user" | null;
  hasUser: boolean;
  displayName: string | null;
  email: string | null;
}

// ─── Nav item definitions ──────────────────────────────────────────────────

const navItems = [
  { label: "Dashboard", href: "/", icon: "grid" },
];

const reservationItems = [
  { label: "Spaces", href: "/rooms", icon: "map" },
  { label: "New Request", href: "/reserve", icon: "plus" },
  { label: "My Reservations", href: "/account", icon: "list" },
];

const adminQueueItems = [
  { label: "Requests",      href: "/admin/bx-reservations",                      icon: "table" },
  { label: "Pending Review", href: "/admin/bx-reservations?status=under_review", icon: "clock" },
  { label: "Calendar",      href: "/admin/bx-reservations?tab=requests",             icon: "calendar" },
];

const adminManageItems = [
  { label: "Users",       href: "/admin/bx-reservations?tab=users",       icon: "users" },
  { label: "Ministries",  href: "/admin/bx-reservations?tab=ministries",  icon: "building" },
  { label: "COI Review",  href: "/admin/bx-reservations/coi",             icon: "shield" },
  { label: "Reports",     href: "/admin/bx-reservations?tab=reports",         icon: "chart" },
  { label: "Settings",    href: "/admin/bx-reservations?tab=settings",    icon: "settings" },
];

// ─── Icon set ─────────────────────────────────────────────────────────────

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    viewBox: "0 0 24 24",
    style: { flexShrink: 0 },
  };

  if (name === "grid") return (
    <svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
  if (name === "plus") return (
    <svg {...props} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
  if (name === "list") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
  if (name === "clock") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (name === "table") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m0 0h17.25m0 0c.621 0 1.125.504 1.125 1.125v1.5m-9.75-10.5h6m-6 4.5h6m-6 4.5h6m4.5-15h-15" />
    </svg>
  );
  if (name === "calendar") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
  if (name === "shield") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
  if (name === "chart") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
  if (name === "settings") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
  if (name === "user") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
  if (name === "login") return (
    <svg {...props} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
  if (name === "users") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
  if (name === "building") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
  if (name === "map") return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
  if (name === "x") return (
    <svg {...props} strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
  return null;
}

// ─── NavLink ──────────────────────────────────────────────────────────────

function NavLink({
  href,
  label,
  icon,
  onClose,
}: {
  href: string;
  label: string;
  icon: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hrefPath, hrefQuery] = href.split("?");
  const currentQuery = searchParams.toString();

  let active: boolean;
  if (hrefQuery) {
    const hrefParams = new URLSearchParams(hrefQuery);
    // Match all query params that the link cares about (status, tab, etc.)
    active =
      pathname === hrefPath &&
      Array.from(hrefParams.entries()).every(
        ([k, v]) => searchParams.get(k) === v
      );
  } else {
    // No query in link href: active only when on the path with no relevant params
    active =
      hrefPath === "/"
        ? pathname === "/"
        : pathname.startsWith(hrefPath) &&
          !searchParams.get("tab") &&
          !searchParams.get("status");
  }

  return (
    <Link
      href={href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 0.75rem",
        borderRadius: "0.5rem",
        fontSize: "0.875rem",
        transition: "background 0.1s, color 0.1s",
        background: active
          ? "color-mix(in srgb, var(--bx-brass) 15%, transparent)"
          : "transparent",
        color: active ? "var(--bx-brass-soft, var(--bx-brass))" : "var(--bx-slate)",
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLAnchorElement).style.background =
            "color-mix(in srgb, var(--bx-brass) 5%, transparent)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
      }}
    >
      <Icon name={icon} size={18} />
      {label}
    </Link>
  );
}

// ─── NavSidebar — portaled, viewport-measured, scroll-locked ──────────────
// Mirrors the MobileNavMenu pattern from BrainerdHQ (components/mobile-nav-menu.tsx):
//   • Portaled to document.body — avoids the backdrop-blur stacking-context bug
//     where a fixed descendant of an ancestor with backdrop-filter clips to that
//     ancestor's height instead of the viewport.
//   • window.visualViewport.height re-measured on resize — the two in-app WebKit
//     browsers we target both have real bugs with plain 100dvh/inset-0 for full-
//     screen drawers; visualViewport is the one source that stays live in both.
//   • Opacity/pointer-events toggle (not mount/unmount) — smooth fade transition.
//   • Body scroll lock while open; Escape to close.

export default function NavSidebar({
  open,
  onClose,
  role,
  hasUser,
  displayName,
  email,
}: NavSidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  const isAdmin = role === "admin";
  const prevOpen = useRef(false);

  // Only render portal after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure viewport height via visualViewport (in-app WebKit fix)
  useEffect(() => {
    function measure() {
      const h =
        window.visualViewport?.height ??
        window.innerHeight ??
        null;
      setVpHeight(h);
    }
    measure();
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("resize", measure);
    return () => {
      window.visualViewport?.removeEventListener("resize", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Body scroll lock + Escape
  useEffect(() => {
    if (open === prevOpen.current) return;
    prevOpen.current = open;

    if (open) {
      document.body.style.overflow = "hidden";
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handler);
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handler);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [open, onClose]);

  if (!mounted) return null;

  const heightStyle = vpHeight ? { height: vpHeight } : { height: "100dvh" };

  const drawer = (
    <>
      {/* Backdrop — full-screen, click to close */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.40)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      {/* Drawer panel — full-width on phone, max-sm drawer from left on larger */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 40,
          width: "100%",
          maxWidth: "24rem", // sm:max-w-sm equivalent
          display: "flex",
          flexDirection: "column",
          background: "var(--bx-ink-soft)",
          borderRight: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
          ...heightStyle,
        }}
      >
        {/* Header row */}
        <div
          style={{
            height: "3.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1rem",
            flexShrink: 0,
            borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
          }}
        >
          <span
            style={{
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "var(--bx-slate)",
            }}
          >
            BX Reservations
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              padding: "0.375rem",
              borderRadius: "0.5rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--bx-slate)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "color-mix(in srgb, var(--bx-parchment) 6%, transparent)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
            }
          >
            <Icon name="x" size={22} />
          </button>
        </div>

        {/* Nav groups */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {/* Top-level links */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} onClose={onClose} />
            ))}
          </div>

          {/* Reservations group */}
          <div>
            <p
              style={{
                padding: "0 0.75rem",
                marginBottom: "0.375rem",
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "color-mix(in srgb, var(--bx-slate) 70%, transparent)",
              }}
            >
              Reservations
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
              {reservationItems.map((item) => (
                <NavLink key={item.href} {...item} onClose={onClose} />
              ))}
            </div>
          </div>

          {/* Admin groups — hidden for non-admin users */}
          {isAdmin && (
            <>
              {/* Queue operations */}
              <div style={{ borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)", paddingTop: "1.5rem" }}>
                <p
                  style={{
                    padding: "0 0.75rem",
                    marginBottom: "0.375rem",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "color-mix(in srgb, var(--bx-slate) 70%, transparent)",
                  }}
                >
                  Admin
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                  {adminQueueItems.map((item) => (
                    <NavLink key={item.href} {...item} onClose={onClose} />
                  ))}
                </div>
              </div>

              {/* People & config */}
              <div>
                <p
                  style={{
                    padding: "0 0.75rem",
                    marginBottom: "0.375rem",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "color-mix(in srgb, var(--bx-slate) 70%, transparent)",
                  }}
                >
                  Manage
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                  {adminManageItems.map((item) => (
                    <NavLink key={item.href} {...item} onClose={onClose} />
                  ))}
                </div>
              </div>
            </>
          )}
        </nav>

        {/* Footer — user info when signed in, sign-in prompt otherwise */}
        <div
          style={{
            padding: "1rem",
            borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            flexShrink: 0,
          }}
        >
          {hasUser && (email || displayName) ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.5rem 0.75rem",
                }}
              >
                <div
                  style={{
                    width: "1.75rem",
                    height: "1.75rem",
                    borderRadius: "50%",
                    background: "var(--bx-parchment)",
                    color: "var(--bx-ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(displayName ?? email ?? "?")[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--bx-parchment)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName || email}
                  </p>
                  {displayName && email && (
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--bx-slate)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {email}
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/account"
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  color: "var(--bx-slate)",
                  textDecoration: "none",
                  background: "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background =
                    "color-mix(in srgb, var(--bx-parchment) 5%, transparent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
                }
              >
                <Icon name="user" size={18} />
                Account settings
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--bx-parchment)",
                  textDecoration: "none",
                  background: "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background =
                    "color-mix(in srgb, var(--bx-parchment) 5%, transparent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
                }
              >
                <Icon name="login" size={18} />
                Sign in
              </Link>
              <p
                style={{
                  padding: "0 0.75rem",
                  fontSize: "0.6875rem",
                  lineHeight: 1.4,
                  color: "var(--bx-slate)",
                }}
              >
                Sign in to save reservations and track your requests.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
}
