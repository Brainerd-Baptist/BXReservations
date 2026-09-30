"use client";

import { useState, useSyncExternalStore } from "react";
import {
  APPEARANCES,
  DEFAULT_APPEARANCE,
  applyAppearance,
  currentAppearance,
  type Appearance,
} from "@/lib/theme";
import { useToast } from "./Toast";

/* Every picker on the page reads the same source of truth — the
   data-appearance attribute on <html> — so they can never disagree. */
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-appearance"] });
  return () => mo.disconnect();
}
const useAppearance = () =>
  useSyncExternalStore(subscribe, currentAppearance, () => DEFAULT_APPEARANCE);

function Icon({ id }: { id: Appearance }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (id === "brainerd")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (id === "glass-dark")
    return (
      <svg {...common}>
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface Props {
  userId?: string;
  size?: "sm" | "lg";
}

export default function AppearancePicker({ userId, size = "sm" }: Props) {
  const active = useAppearance();
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function choose(a: Appearance) {
    if (a === active) return;
    applyAppearance(a);
    if (!userId) return;
    setSaving(true);
    try {
      // Loaded on demand so the header doesn't carry the database client (C2)
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient()
        .from("bx_user_prefs")
        .upsert({ user_id: userId, theme: a, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch {
      // The look changed here, but say honestly that it won't follow you (audit F07)
      toast("Changed on this device, but we couldn't save it to your account.", "error");
    } finally {
      setSaving(false);
    }
  }

  const lg = size === "lg";
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="bx-well relative grid grid-cols-3 rounded-xl p-1 gap-1"
      style={{ opacity: saving ? 0.85 : 1 }}
    >
      {APPEARANCES.map((a) => {
        const on = a.id === active;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={a.description}
            onClick={() => choose(a.id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all ${lg ? "py-2.5 text-sm" : "py-1.5 text-[11px]"}`}
            style={
              on
                ? {
                    background: "var(--bx-surface-strong)",
                    color: "var(--bx-accent-text)",
                    boxShadow: "inset 0 1px 0 var(--bx-highlight), 0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px color-mix(in srgb, var(--bx-brass) 30%, transparent)",
                  }
                : { background: "transparent", color: "var(--bx-slate)" }
            }
          >
            <Icon id={a.id} />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
