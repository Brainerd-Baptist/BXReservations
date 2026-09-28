/**
 * Shared color tokens for status badges across the BX app.
 *
 * Single source of truth — import from here instead of hardcoding
 * badge colors in individual components. Both the reservation-level
 * status chip and the event-logo status chip draw from this file.
 *
 * P7: Physical-metaphor badge system
 * ───────────────────────────────────
 * Each badge is styled like a physical tag or stamp:
 *  - Warm, pigment-like background tints (not digital flat)
 *  - Thin border slightly darker/more saturated than the fill
 *  - Tight letter-spacing applied by the badge renderer
 *
 * Color families:
 *   Amber  → waiting / pending (sticky note)
 *   Indigo → in-progress / review (official stamp)
 *   Orange → action required (warning label)
 *   Green  → approved / complete flow (green stamp)
 *   Parchment → neutral closed states (filed paper)
 *   Red    → rejected / hard cancel (red stamp)
 */

export type BadgeToken = {
  label:   string;
  bg:      string;
  color:   string;
  border?: string;   // optional 1px border for physical tag feel
};

/** Event-logo review status chips */
export const LOGO_STATUS: Record<string, BadgeToken> = {
  none:     { label: "No logo yet",            bg: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)" },
  pending:  { label: "Waiting for review",     bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  approved: { label: "Approved",               bg: "#D1FAE5", color: "#065F46", border: "#A7F3D0" },
  rejected: { label: "Needs a different file", bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
};

/** Reservation workflow status chips — physical-metaphor palette */
export const RESERVATION_STATUS: Record<string, BadgeToken> = {
  // ── Amber: waiting / initial state (sticky note on a desk)
  pending:            { label: "Requested",    bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  pending_insurance:  { label: "Requested",    bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },

  // ── Indigo: active staff review (official stamp / in-tray)
  under_review:       { label: "In Review",    bg: "#EDE9FE", color: "#5B21B6", border: "#DDD6FE" },

  // ── Orange: action required from requester (warning label)
  needs_info:         { label: "Info Needed",  bg: "#FFEDD5", color: "#C2410C", border: "#FED7AA" },
  pending_documents:  { label: "Docs Needed",  bg: "#FFEDD5", color: "#C2410C", border: "#FED7AA" },
  pending_payment:    { label: "Payment Due",  bg: "#FFEDD5", color: "#C2410C", border: "#FED7AA" },

  // ── Green: approved / on track (approval stamp)
  approved:           { label: "Approved",     bg: "#D1FAE5", color: "#065F46", border: "#A7F3D0" },
  confirmed:          { label: "Confirmed",    bg: "#D1FAE5", color: "#065F46", border: "#A7F3D0" },

  // ── Parchment: successfully concluded (filed document)
  completed:          { label: "Completed",    bg: "#F5F1EB", color: "#5C6470", border: "#E2DDD6" },

  // ── Red: rejected / hard staff cancel (red stamp)
  rejected:           { label: "Not Approved", bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  cancelled_by_admin: { label: "Cancelled",    bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },

  // ── Neutral gray: user or auto cancel (voided paper)
  cancelled:          { label: "Cancelled",    bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
  cancelled_by_user:  { label: "Cancelled",    bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
  auto_cancelled:     { label: "Expired",      bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
};

/** Fallback for unknown statuses */
export const BADGE_FALLBACK: BadgeToken = { label: "", bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" };

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
