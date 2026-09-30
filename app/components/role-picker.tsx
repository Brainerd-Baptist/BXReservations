"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import BodyPortal from "./body-portal";
import { useToast } from "./Toast";
import { ROLES_ORDERED, ROLE_LABELS, ROLE_DESCRIPTIONS, type BxRole } from "@/lib/roles";

/**
 * Roles a caller may hand out. Mirrors /api/bx/roles:
 * - Owner: any role, including Owner and System Admin
 * - System Admin: any role below System Admin, and never on an Owner or System Admin
 * - everyone else: none
 */
export function assignableRoles(caller: BxRole | null, target: BxRole | null): BxRole[] {
  if (caller === "owner") return ROLES_ORDERED;
  if (caller === "system_admin") {
    if (target === "owner" || target === "system_admin") return [];
    return ROLES_ORDERED.filter((r) => r !== "owner" && r !== "system_admin");
  }
  return [];
}

const MENU_W = 256; // px

/**
 * Role dropdown. The menu renders on its own top layer (portaled to <body>,
 * position: fixed) so table scroll boxes and neighbouring glass cards can
 * never clip or cover it. Save errors show the server's reason in a toast.
 */
export default function RolePicker({
  userId,
  current,
  callerRole,
  onSaved,
  size = "sm",
  badge,
}: {
  userId: string;
  current: BxRole | null;
  callerRole: BxRole | null;
  onSaved: (role: BxRole) => void;
  size?: "sm" | "md";
  /** Rendered instead of the picker when the caller can't change this user. */
  badge: React.ReactNode;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<BxRole | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const choices = assignableRoles(callerRole, current);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth, vh = window.innerHeight, gap = 6, pad = 8;
    const left = Math.min(Math.max(pad, b.left), vw - MENU_W - pad);
    const below = vh - b.bottom - gap - pad;
    const above = b.top - gap - pad;
    // Open downward unless there's clearly more room above.
    if (below >= 240 || below >= above) setPos({ top: b.bottom + gap, left, maxH: below });
    else setPos({ top: Math.max(pad, b.top - gap - Math.min(above, 420)), left, maxH: Math.min(above, 420) });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); btnRef.current?.focus(); }
    };
    // The menu is fixed; if the page moves under it, just close.
    const onScroll = (e: Event) => { if (!menuRef.current?.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    // Move focus to the current choice (or the first one)
    requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
      const on = menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      (on ?? items?.[0])?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!choices.length) return <>{badge}</>;

  async function pick(r: BxRole) {
    setOpen(false);
    btnRef.current?.focus();
    if (r === current) return;
    setSaving(r);
    try {
      const res = await fetch("/api/bx/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: r }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "The role couldn't be saved.");
      onSaved(r);
      toast(`Role changed to ${ROLE_LABELS[r]}.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "The role couldn't be saved.", "error");
    } finally {
      setSaving(null);
    }
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === "ArrowDown" ? (i + 1) % items.length
      : e.key === "ArrowUp" ? (i - 1 + items.length) % items.length
      : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (to < 0) { if (e.key === "Tab") setOpen(false); return; }
    e.preventDefault();
    items[to]?.focus();
  }

  const shown = saving ?? current;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!!saving}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Role: ${current ? ROLE_LABELS[current] : "none"}. Change role`}
        className={`bx-role-btn ${size === "md" ? "bx-role-btn--md" : ""}`}
      >
        {saving && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
        <span>{shown ? ROLE_LABELS[shown] : "Assign role"}</span>
        {!saving && <ChevronDown size={12} aria-hidden="true" />}
      </button>
      {open && pos && (
        <BodyPortal>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Choose a role"
            onKeyDown={onMenuKey}
            className="bx-role-menu bx-glass-strong"
            style={{ top: pos.top, left: pos.left, width: MENU_W, maxHeight: pos.maxH }}
          >
            {choices.map((r) => (
              <button
                key={r}
                type="button"
                role="menuitemradio"
                aria-checked={current === r}
                onClick={() => pick(r)}
                className="bx-role-menu__item"
              >
                <Check size={13} aria-hidden="true" className={`bx-role-menu__check ${current === r ? "is-on" : ""}`} />
                <span>
                  <span className="bx-role-menu__label">{ROLE_LABELS[r]}</span>
                  <span className="bx-role-menu__desc">{ROLE_DESCRIPTIONS[r]}</span>
                </span>
              </button>
            ))}
          </div>
        </BodyPortal>
      )}
    </>
  );
}
