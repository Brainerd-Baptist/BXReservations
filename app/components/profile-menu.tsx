"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { THEMES, type ThemeId, DEFAULT_THEME, THEME_STORAGE_KEY, applyTheme, isValidTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";

// Quick-pick themes shown in the dropdown (first 3 — Brainerd, Midnight, Daylight)
const QUICK_THEMES = THEMES.filter((t): t is typeof t & { quick: true } => 'quick' in t && !!(t as { quick?: boolean }).quick);

interface ProfileMenuProps {
  userId: string;
  initials: string;
  role: "admin" | "user" | null;
  email: string;
  displayName: string | null;
  savedTheme?: string | null;
}

function ThemeSwatch({ colors, size = "sm" }: { colors: readonly string[]; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "100%" : "1rem";
  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: "50%",
        overflow: "hidden",
        width: dim,
        height: dim,
        flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {colors.slice(0, 2).map((c, i) => (
        <span key={i} style={{ background: c, flex: 1 }} />
      ))}
    </span>
  );
}

export default function ProfileMenu({
  userId,
  initials,
  role,
  email,
  displayName,
  savedTheme,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => {
    if (isValidTheme(savedTheme ?? null)) return savedTheme as ThemeId;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isValidTheme(stored)) return stored;
    }
    return DEFAULT_THEME;
  });
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  // Sync activeTheme with the DOM on mount
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (isValidTheme(current)) setActiveTheme(current);
  }, []);

  async function handleThemeClick(id: ThemeId) {
    if (saving) return;
    setActiveTheme(id);
    applyTheme(id);
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("bx_user_prefs")
      .upsert({ user_id: userId, theme: id, updated_at: new Date().toISOString() });
    setSaving(false);
  }

  return (
    <div className="relative">
      {/* Avatar button */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={role === "admin" ? "Admin" : "My account"}
        aria-label="Open account menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-opacity hover:opacity-85"
        style={{ background: "var(--bx-parchment)", color: "var(--bx-ink)" }}
      >
        {initials || "?"}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="dropdown-panel absolute right-0 top-10 w-60 z-50 p-3 flex flex-col gap-2.5"
        >
          {/* Identity */}
          <div className="px-1">
            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--bx-parchment)" }}>
              {displayName || email}
            </p>
            {displayName && (
              <p className="text-xs mt-0.5" style={{ color: "var(--bx-slate)" }}>
                {email}
              </p>
            )}
            {role === "admin" && (
              <span
                className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{
                  background: "color-mix(in srgb, var(--bx-brass) 20%, transparent)",
                  color: "var(--bx-brass)",
                }}
              >
                Admin
              </span>
            )}
          </div>

          {/* Divider */}
          <hr style={{ borderColor: "color-mix(in srgb, var(--bx-brass) 15%, transparent)" }} />

          {/* Quick-pick themes */}
          <div>
            <p className="text-[10px] uppercase tracking-wide mb-1.5 px-1" style={{ color: "var(--bx-slate)" }}>
              Appearance
            </p>
            <div className="flex gap-1.5 px-1">
              {QUICK_THEMES.map((t) => {
                const isActive = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={saving}
                    onClick={() => handleThemeClick(t.id)}
                    title={t.label}
                    className="flex flex-col items-center gap-1 flex-1 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: isActive
                        ? "color-mix(in srgb, var(--bx-brass) 15%, transparent)"
                        : "transparent",
                      border: isActive
                        ? "1px solid color-mix(in srgb, var(--bx-brass) 35%, transparent)"
                        : "1px solid transparent",
                    }}
                  >
                    <ThemeSwatch colors={t.swatch} />
                    <span
                      className="text-[9px] font-medium leading-none"
                      style={{ color: isActive ? "var(--bx-brass)" : "var(--bx-slate)" }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <hr style={{ borderColor: "color-mix(in srgb, var(--bx-brass) 15%, transparent)" }} />

          {/* Links */}
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: "var(--bx-parchment)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "color-mix(in srgb, var(--bx-brass) 10%, transparent)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Account settings
          </Link>

          {role === "admin" && (
            <Link
              href="/admin/bx-reservations"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: "var(--bx-parchment)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "color-mix(in srgb, var(--bx-brass) 10%, transparent)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              Admin dashboard
            </Link>
          )}

          {/* Sign out */}
          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: "var(--bx-slate)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "color-mix(in srgb, var(--bx-clay) 10%, transparent)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--bx-clay)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--bx-slate)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
