"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// BX-specific optional email notifications. Mirrors the optional/always-on
// split from BrainerdHQ and Personnel — same toggle mechanics, same upsert
// pattern, just BX's own notification types.
const OPTIONAL_NOTIFICATIONS: {
  key: "notify_reservation_confirmed" | "notify_reservation_reminder" | "notify_admin_message";
  label: string;
  description: string;
}[] = [
  {
    key: "notify_reservation_confirmed",
    label: "Reservation confirmed / denied",
    description:
      "Sent when an admin approves or denies your reservation request — so you know the moment a decision is made.",
  },
  {
    key: "notify_reservation_reminder",
    label: "Upcoming reservation reminder",
    description:
      "A heads-up 48 hours before your reservation so you have time to prepare.",
  },
  {
    key: "notify_admin_message",
    label: "Messages from staff",
    description:
      "If an admin leaves a note on your reservation — a question, a policy reminder, or a change — you'll get an email.",
  },
];

const ALWAYS_ON_NOTIFICATIONS = [
  {
    label: "Account & access emails",
    description:
      "Password resets and sign-in confirmations — keeps your account accessible.",
  },
];

function Toggle({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{
        background: on
          ? "color-mix(in srgb, var(--bx-brass) 60%, transparent)"
          : "color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
        border: on
          ? "none"
          : "1px solid color-mix(in srgb, var(--bx-brass) 30%, transparent)",
      }}
    >
      <span
        className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform"
        style={{
          background: "var(--bx-ink-soft)",
          transform: on ? "translateX(18px)" : "translateX(2px)",
        }}
      />
    </button>
  );
}

export type BxNotificationPrefs = {
  notify_reservation_confirmed: boolean;
  notify_reservation_reminder: boolean;
  notify_admin_message: boolean;
};

export default function NotificationPreferencesSection({
  userId,
  initialPrefs,
}: {
  userId: string;
  initialPrefs: BxNotificationPrefs;
}) {
  const supabase = createClient();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(key: keyof BxNotificationPrefs) {
    const next = !prefs[key];
    setSavingKey(key);
    setError("");
    setPrefs((p) => ({ ...p, [key]: next }));
    const { error: upsertError } = await supabase
      .from("bx_user_prefs")
      .upsert({
        user_id: userId,
        [key]: next,
        updated_at: new Date().toISOString(),
      });
    setSavingKey(null);
    if (upsertError) {
      setPrefs((p) => ({ ...p, [key]: !next }));
      setError("Couldn't save that change — try again.");
    }
  }

  return (
    <section
      className="rounded-xl p-5"
      style={{
        border: "1px solid color-mix(in srgb, var(--bx-brass) 20%, transparent)",
        background: "color-mix(in srgb, var(--bx-ink-soft) 80%, transparent)",
      }}
    >
      <p
        className="text-xs uppercase tracking-wide mb-1"
        style={{ color: "var(--bx-slate)" }}
      >
        Email notifications
      </p>
      <p className="text-xs mb-4" style={{ color: "color-mix(in srgb, var(--bx-slate) 70%, transparent)" }}>
        Everything BX Reservations might email you about. The three below are yours to turn off.
      </p>

      <div className="space-y-4">
        {OPTIONAL_NOTIFICATIONS.map((n) => (
          <div key={n.key} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm" style={{ color: "var(--bx-parchment)" }}>
                {n.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--bx-slate)" }}>
                {n.description}
              </p>
            </div>
            <Toggle
              on={prefs[n.key]}
              disabled={savingKey === n.key}
              onToggle={() => toggle(n.key)}
            />
          </div>
        ))}
      </div>

      <div
        className="mt-5 pt-4 space-y-4"
        style={{ borderTop: "1px solid color-mix(in srgb, var(--bx-brass) 10%, transparent)" }}
      >
        <p
          className="text-xs uppercase tracking-wide flex items-center gap-1.5"
          style={{ color: "color-mix(in srgb, var(--bx-slate) 70%, transparent)" }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Always on
        </p>
        {ALWAYS_ON_NOTIFICATIONS.map((n) => (
          <div key={n.label} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm" style={{ color: "var(--bx-slate)" }}>
                {n.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--bx-slate) 60%, transparent)" }}>
                {n.description}
              </p>
            </div>
            <Toggle on disabled onToggle={() => {}} />
          </div>
        ))}
        <p
          className="text-xs"
          style={{ color: "color-mix(in srgb, var(--bx-slate) 60%, transparent)" }}
        >
          These stay on because missing one could leave you locked out of your account.
        </p>
      </div>

      {error && (
        <p className="text-xs mt-3" style={{ color: "var(--bx-clay)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
