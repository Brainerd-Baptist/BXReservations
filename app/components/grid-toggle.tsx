"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const GRID_DOTS_KEY = "bx-reservations-grid-dots";
export const GRID_LINES_KEY = "bx-reservations-grid-lines";

export function applyGridDots(enabled: boolean) {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.setAttribute("data-grid-dots", "on");
  } else {
    document.documentElement.removeAttribute("data-grid-dots");
  }
  try { window.localStorage.setItem(GRID_DOTS_KEY, enabled ? "on" : "off"); } catch {}
}

export function applyGridLines(enabled: boolean) {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.setAttribute("data-grid-lines", "on");
  } else {
    document.documentElement.removeAttribute("data-grid-lines");
  }
  try { window.localStorage.setItem(GRID_LINES_KEY, enabled ? "on" : "off"); } catch {}
}

function Toggle({
  enabled,
  onToggle,
  saving,
}: {
  enabled: boolean;
  onToggle: () => void;
  saving: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={saving}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
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

export default function GridToggle({
  userId,
  savedDots,
  savedLines,
}: {
  userId: string;
  savedDots: boolean;
  savedLines: boolean;
}) {
  const [dotsEnabled, setDotsEnabled] = useState(savedDots);
  const [linesEnabled, setLinesEnabled] = useState(savedLines);
  const [savingDots, setSavingDots] = useState(false);
  const [savingLines, setSavingLines] = useState(false);

  useEffect(() => {
    try {
      const storedDots = localStorage.getItem(GRID_DOTS_KEY);
      const storedLines = localStorage.getItem(GRID_LINES_KEY);
      const d = storedDots !== null ? storedDots !== "off" : savedDots;
      const l = storedLines !== null ? storedLines !== "off" : savedLines;
      setDotsEnabled(d);
      setLinesEnabled(l);
      applyGridDots(d);
      applyGridLines(l);
    } catch {
      applyGridDots(savedDots);
      applyGridLines(savedLines);
    }
  }, [savedDots, savedLines]);

  async function handleDotsToggle() {
    if (savingDots) return;
    const next = !dotsEnabled;
    setDotsEnabled(next);
    applyGridDots(next);
    setSavingDots(true);
    const supabase = createClient();
    await supabase.from("bx_user_prefs").upsert({
      user_id: userId,
      show_grid: next,
      updated_at: new Date().toISOString(),
    });
    setSavingDots(false);
  }

  async function handleLinesToggle() {
    if (savingLines) return;
    const next = !linesEnabled;
    setLinesEnabled(next);
    applyGridLines(next);
    setSavingLines(true);
    const supabase = createClient();
    await supabase.from("bx_user_prefs").upsert({
      user_id: userId,
      show_grid_lines: next,
      updated_at: new Date().toISOString(),
    });
    setSavingLines(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--bx-ink)" }}>
            Background dots
          </p>
          <p className="text-xs" style={{ color: "color-mix(in srgb, var(--bx-ink) 60%, transparent)" }}>
            Subtle dot pattern on page backgrounds.
          </p>
        </div>
        <Toggle enabled={dotsEnabled} onToggle={handleDotsToggle} saving={savingDots} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--bx-ink)" }}>
            Background grid lines
          </p>
          <p className="text-xs" style={{ color: "color-mix(in srgb, var(--bx-ink) 60%, transparent)" }}>
            Fine crosshatch pattern on page backgrounds.
          </p>
        </div>
        <Toggle enabled={linesEnabled} onToggle={handleLinesToggle} saving={savingLines} />
      </div>
    </div>
  );
}
