"use client";

import { useEffect, useRef, useState } from "react";

interface NotificationBellProps {
  /** href to navigate to when the bell is clicked (defaults to /account) */
  href?: string;
}

export default function NotificationBell({ href = "/account" }: NotificationBellProps) {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    fetch("/api/notifications/count", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => {
        if (mountedRef.current) {
          setCount(d.count ?? 0);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (mountedRef.current) setLoaded(true);
      });

    // Re-fetch every 60 s while the page is open
    const interval = setInterval(() => {
      fetch("/api/notifications/count", { cache: "no-store" })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => { if (mountedRef.current) setCount(d.count ?? 0); })
        .catch(() => {});
    }, 60_000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <a
      href={href}
      aria-label={count > 0 ? `${count} unread notification${count !== 1 ? "s" : ""}` : "Notifications"}
      className="relative p-1.5 rounded-lg transition-colors flex items-center justify-center"
      style={{ color: "var(--bx-slate)" }}
      onMouseEnter={e =>
        ((e.currentTarget as HTMLAnchorElement).style.background =
          "color-mix(in srgb, var(--bx-parchment) 8%, transparent)")
      }
      onMouseLeave={e =>
        ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
      }
    >
      {/* Bell icon */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Badge — only render once loaded to avoid flash */}
      {loaded && count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1 select-none"
          style={{ background: "#ef4444", color: "#ffffff" }}
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </a>
  );
}
