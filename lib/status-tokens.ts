/**
 * Shared color tokens for status badges across the BX app.
 *
 * Single source of truth — import from here instead of hardcoding
 * badge colors in individual components. Both the reservation-level
 * status chip and the event-logo status chip draw from this file.
 */

export type BadgeToken = { label: string; bg: string; color: string };

/** Event-logo review status chips */
export const LOGO_STATUS: Record<string, BadgeToken> = {
  none:     { label: "No logo yet",            bg: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)" },
  pending:  { label: "Waiting for review",     bg: "#FEF3C7", color: "#92400E" },
  approved: { label: "Approved",               bg: "#D1FAE5", color: "#065F46" },
  rejected: { label: "Needs a different file", bg: "#FEE2E2", color: "#991B1B" },
};

/** Reservation workflow status chips */
export const RESERVATION_STATUS: Record<string, BadgeToken> = {
  pending:            { label: "Requested",    bg: "#FEF9C3", color: "#713F12" },
  under_review:       { label: "In Review",    bg: "#E0E7FF", color: "#3730A3" },
  needs_info:         { label: "Info Needed",  bg: "#FEF3C7", color: "#92400E" },
  pending_documents:  { label: "Docs Needed",  bg: "#FEF3C7", color: "#92400E" },
  pending_payment:    { label: "Payment Due",  bg: "#FEF3C7", color: "#92400E" },
  approved:           { label: "Approved",     bg: "#D1FAE5", color: "#065F46" },
  confirmed:          { label: "Confirmed",    bg: "#D1FAE5", color: "#065F46" },
  completed:          { label: "Completed",    bg: "#F3F4F6", color: "#374151" },
  rejected:           { label: "Not Approved", bg: "#FEE2E2", color: "#991B1B" },
  cancelled:          { label: "Cancelled",    bg: "#F3F4F6", color: "#374151" },
  cancelled_by_admin: { label: "Cancelled",    bg: "#FEE2E2", color: "#991B1B" },
  cancelled_by_user:  { label: "Cancelled",    bg: "#F3F4F6", color: "#374151" },
  auto_cancelled:     { label: "Expired",      bg: "#F3F4F6", color: "#374151" },
};

/** Fallback for unknown statuses */
export const BADGE_FALLBACK: BadgeToken = { label: "", bg: "#F3F4F6", color: "#374151" };

/**
 * Button semantic roles used across staff panels.
 *
 * primary  – main upload/replace action (teal)
 * action   – communicative / non-destructive staff action (amber) e.g. "Send to planner"
 * confirm  – approval action (green)
 * danger   – permanently destructive action only (red) e.g. "Yes, remove it"
 * ghost    – secondary / cancel (outlined)
 */
export type BtnKind = "primary" | "action" | "confirm" | "danger" | "ghost";
