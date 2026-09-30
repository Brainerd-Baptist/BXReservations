"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NOTIFICATIONS_CHANGED } from "@/lib/notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  reservation_id: string | null;
}
interface Counts { count: number; unread: number; invites: number; awaitingReview: number; staff: boolean }
const ZERO: Counts = { count: 0, unread: 0, invites: 0, awaitingReview: 0, staff: false };

/**
 * Header bell. The badge counts only things that clear when you've seen
 * them: unread notifications and invitations waiting on you. Opening a
 * booking any way — bell, email link, My Reservations, the admin list —
 * marks its notifications read, and the badge re-checks on every page
 * change, when the tab regains focus, and when a page says it changed.
 */
export default function NotificationBell() {
  const [c, setC] = useState<Counts>(ZERO);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);
  const pathname = usePathname();
  const router = useRouter();
  const [now, setNow] = useState(0);

  const fetchCount = useCallback(() => {
    fetch("/api/notifications/count", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : ZERO))
      .then((d: Counts) => { if (mountedRef.current) { setC({ ...ZERO, ...d }); setLoaded(true); } })
      .catch(() => { if (mountedRef.current) setLoaded(true); });
  }, []);

  const fetchList = useCallback(() => {
    fetch("/api/notifications/list", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d) => { if (mountedRef.current) { setNotifications(d.notifications ?? []); setNow(Date.now()); setListLoaded(true); } })
      .catch(() => { if (mountedRef.current) setListLoaded(true); });
  }, []);

  // Poll, realtime inserts, focus, and "a page marked something read"
  useEffect(() => {
    mountedRef.current = true;
    const interval = setInterval(fetchCount, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchCount(); };
    const onChanged = () => fetchCount();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onChanged);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);

    const supabase = createClient();
    const channel = supabase
      .channel("bx_notifications_bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "bx_notifications" }, () => { if (mountedRef.current) fetchCount(); })
      .subscribe();

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onChanged);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged);
      void supabase.removeChannel(channel);
    };
  }, [fetchCount]);

  // Every navigation: a page you just opened may have marked things read
  useEffect(() => { fetchCount(); }, [pathname, fetchCount]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function toggle() {
    if (!open) fetchList();
    setOpen((o) => !o);
  }

  async function markAllRead() {
    await fetch("/api/notifications/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    fetchCount();
  }

  async function openNotification(n: Notification) {
    if (!n.read_at) {
      await fetch("/api/notifications/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
    }
    if (n.reservation_id) {
      // Staff work bookings in the admin dashboard; everyone else on the booking page
      setOpen(false);
      router.push(c.staff ? `/admin/bx-reservations?open=${n.reservation_id}` : `/reservations/${n.reservation_id}`);
    } else {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      fetchCount();
    }
  }

  function formatTime(iso: string) {
    const diff = (now - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const hasUnread = notifications.some((n) => !n.read_at) || c.unread > 0;
  const rowBase: React.CSSProperties = {
    width: "100%", textAlign: "left", padding: "12px 16px", borderBottom: "1px solid var(--bx-hairline-soft)",
    display: "flex", gap: 10, alignItems: "flex-start", background: "transparent", cursor: "pointer",
  };

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={c.count > 0 ? `Notifications, ${c.count} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative p-1.5 rounded-lg transition-colors flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--bx-parchment)_8%,transparent)]"
        style={{ color: "var(--bx-slate)", background: "transparent", border: "none", cursor: "pointer" }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {loaded && c.count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1 select-none"
            style={{ background: "var(--bx-clay)", color: "#ffffff" }}
            aria-hidden="true"
          >
            {c.count > 99 ? "99+" : c.count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, width: "min(340px, calc(100vw - 24px))",
            background: "var(--bx-surface-menu)", border: "1px solid var(--bx-hairline)", borderRadius: 14,
            boxShadow: "inset 0 1px 0 var(--bx-highlight), 0 16px 40px -8px rgba(0,0,0,0.28)", zIndex: 1000, overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid var(--bx-hairline)" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--bx-parchment)" }}>Notifications</span>
            {hasUnread && (
              <button type="button" onClick={markAllRead}
                style={{ fontSize: 12, color: "var(--bx-accent-text)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {/* Things that wait on you (not cleared by reading) */}
            {c.invites > 0 && (
              <a href="/account/invites" style={{ ...rowBase, textDecoration: "none", background: "color-mix(in srgb, var(--bx-brass) 8%, transparent)" }}>
                <Dot on />
                <span style={{ flex: 1, fontSize: 13, color: "var(--bx-parchment)", fontWeight: 600 }}>
                  {c.invites} invitation{c.invites === 1 ? "" : "s"} to join a booking
                  <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--bx-slate)" }}>Accept or decline →</span>
                </span>
              </a>
            )}
            {c.staff && c.awaitingReview > 0 && (
              <a href="/admin/bx-reservations?status=Requested" style={{ ...rowBase, textDecoration: "none" }}>
                <Dot on={false} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--bx-parchment)" }}>
                  {c.awaitingReview} request{c.awaitingReview === 1 ? "" : "s"} awaiting review
                  <span style={{ display: "block", fontSize: 12, color: "var(--bx-slate)" }}>Open the queue →</span>
                </span>
              </a>
            )}

            {!listLoaded ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--bx-slate)", fontSize: 13 }}>Loading…</div>
            ) : notifications.length === 0 && !c.invites && !(c.staff && c.awaitingReview) ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--bx-slate)", fontSize: 13 }}>You&apos;re all caught up.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className="hover:bg-[color-mix(in_srgb,var(--bx-parchment)_6%,transparent)]"
                  style={{ ...rowBase, border: "none", borderBottom: rowBase.borderBottom, background: n.read_at ? "transparent" : "color-mix(in srgb, var(--bx-brass) 8%, transparent)" }}
                >
                  <Dot on={!n.read_at} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: n.read_at ? 400 : 600, fontSize: 13, color: "var(--bx-parchment)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {!n.read_at && <span className="sr-only">Unread: </span>}{n.title}
                    </span>
                    <span style={{ display: "-webkit-box", fontSize: 12, color: "var(--bx-slate)", lineHeight: 1.4, WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.body}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--bx-slate)", marginTop: 4 }}>{formatTime(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--bx-hairline)", textAlign: "center" }}>
            <a href={c.staff ? "/admin/bx-reservations" : "/reservations"} style={{ fontSize: 12, color: "var(--bx-accent-text)", textDecoration: "none", fontWeight: 600 }}>
              {c.staff ? "Open the dashboard →" : "View all reservations →"}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" style={{ marginTop: 5, flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: on ? "var(--bx-accent-text)" : "transparent", border: on ? "none" : "1px solid var(--bx-hairline)" }} />
  );
}
