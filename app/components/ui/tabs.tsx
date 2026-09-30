"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

/**
 * Accessible tabs (W3C APG pattern): one tab stop for the whole row, arrow
 * keys / Home / End move between tabs, the selected tab is announced.
 * Pair each tab with a panel: <div role="tabpanel" id={panelId(key)} aria-labelledby={tabId(key)}>.
 */
export type TabItem<K extends string> = { key: K; label: ReactNode; count?: number };

export const tabId = (group: string, key: string) => `${group}-tab-${key}`;
export const panelId = (group: string, key: string) => `${group}-panel-${key}`;

export function Tabs<K extends string>({
  group,
  items,
  value,
  onChange,
  label,
  className,
}: {
  group: string;
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const last = items.length - 1;
    const to = e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(items[to].key);
    refs.current[to]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className={["bx-tabs", className].filter(Boolean).join(" ")}>
      {items.map((t, i) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            type="button"
            id={tabId(group, t.key)}
            aria-selected={on}
            aria-controls={panelId(group, t.key)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className="bx-tab"
          >
            {t.label}
            {typeof t.count === "number" && <span className="bx-tab__count tabular">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
