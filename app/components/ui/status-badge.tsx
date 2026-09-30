import { RESERVATION_STATUS, BADGE_FALLBACK } from "@/lib/status-tokens";

/**
 * One status badge everywhere, from the shared, theme-aware status tokens.
 * Reads well in Light and Dark; the label is the words people see.
 */
export default function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const t = RESERVATION_STATUS[status] ?? { ...BADGE_FALLBACK, label: status.replace(/_/g, " ") };
  return (
    <span
      className={`bx-badge bx-status bx-status--${size}`}
      style={{ background: t.bg, color: t.color, borderColor: t.border ?? "transparent" }}
    >
      {t.label}
    </span>
  );
}
