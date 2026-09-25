"use client";

import { useEffect, useState } from "react";
import { THEMES, type ThemeId, DEFAULT_THEME, THEME_STORAGE_KEY, applyTheme, isValidTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";

interface ThemeGridProps {
  userId: string;
  savedTheme: string | null;
}

function ThemeSwatch({ colors }: { colors: readonly string[] }) {
  return (
    <span className="inline-flex rounded-full overflow-hidden w-5 h-5 shrink-0 border border-white/10">
      {colors.slice(0, 2).map((c, i) => (
        <span key={i} style={{ background: c, flex: 1 }} />
      ))}
    </span>
  );
}

export default function ThemeGrid({ userId, savedTheme }: ThemeGridProps) {
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => {
    if (isValidTheme(savedTheme)) return savedTheme;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isValidTheme(stored)) return stored;
    }
    return DEFAULT_THEME;
  });
  const [saving, setSaving] = useState(false);

  // Sync with DOM on mount
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (isValidTheme(current)) setActiveTheme(current);
  }, []);

  async function handleSelect(id: ThemeId) {
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.5rem",
      }}
    >
      {THEMES.map((t) => {
        const isActive = activeTheme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={saving}
            onClick={() => handleSelect(t.id)}
            title={t.description}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.625rem 0.375rem",
              borderRadius: "0.625rem",
              border: isActive
                ? "1.5px solid var(--bx-brass)"
                : "1.5px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
              background: isActive
                ? "color-mix(in srgb, var(--bx-brass) 10%, transparent)"
                : "transparent",
              cursor: saving ? "not-allowed" : "pointer",
              transition: "border-color 0.15s, background 0.15s",
              opacity: saving && !isActive ? 0.7 : 1,
            }}
          >
            <ThemeSwatch colors={t.swatch} />
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--bx-brass)" : "var(--bx-slate)",
                lineHeight: 1.2,
                textAlign: "center",
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
