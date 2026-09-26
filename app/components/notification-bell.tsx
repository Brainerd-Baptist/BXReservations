"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  reservation_id: string | null;
}

export default function NotificationBell() {
  const [count, setCount]               = useState(0);
  const [loaded, setLoaded]             = useState(false);
  const [open, setOpen]                 = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [listLoaded, setListLoaded]     = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(() => {
    fetch("/api/notifications/count", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => { if (mountedRef.current) { setCount(d.count ?? 0); setLoaded(true); } })
      .catch(() => { if (mountedRef.current) setLoaded(true); });
  }, []);

  const fetchList = useCallback(() => {
    fetch("/api/notifications/list", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => {
        if (mountedRef.current) {
          setNotifications(d.notifications ?? []);
          setListLoaded(true);
        }
      })
      .catch(() => { if (mountedRef.current) setListLoaded(true); });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => { mountedRef.current = false; clearInterval(interval); };
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleBellClick() {
    if (!open) {
      fetchList();
    }
    setOpen(o => !o);
  }

  async function markAllRead() {
    await fetch("/api/notifications/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    setCount(0);
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setCount(prev => Math.max(0, prev - 1));
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-flex" }}>
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        aria-label={count > 0 ? `${count} unread notification${count !== 1 ? "s" : ""}` : "Notifications"}
        aria-expanded={open}
        className="relative p-1.5 rounded-lg transition-colors flex items-center justify-center"
        style={{ color: "var(--bx-slate)", background: "transparent", border: "none", cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.background = "color-mix(in srgb, var(--bx-parchment) 8%, transparent)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {loaded && count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1 select-none"
            style={{ background: "#ef4444", color: "#ffffff" }}
            aria-hidden="true"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            zIndex: 1000,
            overflow: "hidden",
          }}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Notifications</span>
            {count > 0 && (
              <button
                onClick={markAllRead}
                style={{ fontSize: 12, color: "#00abc9", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {!listLoaded ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Loading…</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                <svg style={{ width: 32, height: 32, margin: "0 auto 8px", display: "block", opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.read_at) markOneRead(n.id); if (n.reservation_id) window.location.href = `/reservations/${n.reservation_id}`; }}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f9fafb",
                    cursor: "pointer",
                    background: n.read_at ? "#ffffff" : "#f0f9ff",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = n.read_at ? "#f9fafb" : "#e0f4fb")}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read_at ? "#ffffff" : "#f0f9ff")}
                >
                  {/* Unread dot */}
                  <div style={{ marginTop: 4, flexShrink: 0 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: n.read_at ? "transparent" : "#00abc9",
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: n.read_at ? 400 : 600, fontSize: 13, color: "#111827", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{formatTime(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #f3f4f6", textAlign: "center" }}>
            <a href="/reservations" style={{ fontSize: 12, color: "#00abc9", textDecoration: "none", fontWeight: 500 }}>View all reservations →</a>
          </div>
        </div>
      )}
    </div>
  );
}
