"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const GRID_STORAGE_KEY = "bx-reservations-grid";

export function applyGrid(enabled: boolean) {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.removeAttribute("data-grid");
  } else {
    document.documentElement.setAttribute("data-grid", "off");
  }
  try {
    window.localStorage.setItem(GRID_STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
}

interface GridToggleProps {
  userId: string;
  savedGrid: boolean;
}

export default function GridToggle({ userId, savedGrid }: GridToggleProps) {
  const [enabled, setEnabled] = useState(savedGrid);
  const [saving, setSaving] = useState(false);

  // Sync with DOM on mount (localStorage may differ from DB)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GRID_STORAGE_KEY);
      if (stored !== null) {
        const val = stored !== "off";
        setEnabled(val);
        applyGrid(val);
        return;
      }
    } catch {}
    applyGrid(savedGrid);
  }, [savedGrid]);

  async function handleToggle() {
    if (saving) return;
    const next = !enabled;
    setEnabled(next);
    applyGrid(next);
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("bx_user_prefs")
      .upsert({ user_id: userId, show_grid: next, updated_at: new Date().toISOString() });
    setSaving(false);
  }

  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={handleToggle}
      disabled={saving}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: enabled
          ? "var(--bx-brass)"
          : "color-mix(in srgb, var(--bx-parchment) 20%, transparent)",
        opacity: saving ? 0.6 : 1,
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full transition-transform"
        style={{
          background: "var(--bx-parchment)",
          transform: enabled ? "translateX(1.375rem)" : "translateX(0.25rem)",
        }}
      />
    </button>
  );
}
