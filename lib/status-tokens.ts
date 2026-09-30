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
  pending:  { label: "Waiting for review",     bg: "var(--tone-amber-bg)", color: "var(--tone-amber-fg)", border: "var(--tone-amber-bd)" },
  approved: { label: "Approved",               bg: "var(--tone-green-bg)", color: "var(--tone-green-fg)", border: "var(--tone-green-bd)" },
  rejected: { label: "Needs a different file", bg: "var(--tone-red-bg)", color: "var(--tone-red-fg)", border: "var(--tone-red-bd)" },
};

/** Reservation workflow status chips — physical-metaphor palette */
export const RESERVATION_STATUS: Record<string, BadgeToken> = {
  // ── Amber: waiting / initial state (sticky note on a desk)
  pending:            { label: "Requested",    bg: "var(--tone-amber-bg)", color: "var(--tone-amber-fg)", border: "var(--tone-amber-bd)" },
  pending_insurance:  { label: "Requested",    bg: "var(--tone-amber-bg)", color: "var(--tone-amber-fg)", border: "var(--tone-amber-bd)" },

  // ── Indigo: active staff review (official stamp / in-tray)
  under_review:       { label: "In Review",    bg: "var(--tone-indigo-bg)", color: "var(--tone-indigo-fg)", border: "var(--tone-indigo-bd)" },

  // ── Orange: action required from requester (warning label)
  needs_info:         { label: "Info Needed",  bg: "var(--tone-orange-bg)", color: "var(--tone-orange-fg)", border: "var(--tone-orange-bd)" },
  pending_documents:  { label: "Docs Needed",  bg: "var(--tone-orange-bg)", color: "var(--tone-orange-fg)", border: "var(--tone-orange-bd)" },
  pending_payment:    { label: "Payment Due",  bg: "var(--tone-orange-bg)", color: "var(--tone-orange-fg)", border: "var(--tone-orange-bd)" },

  // ── Green: approved / on track (approval stamp)
  approved:           { label: "Approved",     bg: "var(--tone-green-bg)", color: "var(--tone-green-fg)", border: "var(--tone-green-bd)" },
  confirmed:          { label: "Confirmed",    bg: "var(--tone-green-bg)", color: "var(--tone-green-fg)", border: "var(--tone-green-bd)" },

  // ── Parchment: successfully concluded (filed document)
  completed:          { label: "Completed",    bg: "var(--tone-stone-bg)", color: "var(--tone-stone-fg)", border: "var(--tone-stone-bd)" },

  // ── Red: rejected / hard staff cancel (red stamp)
  rejected:           { label: "Not Approved", bg: "var(--tone-red-bg)", color: "var(--tone-red-fg)", border: "var(--tone-red-bd)" },
  cancelled_by_admin: { label: "Cancelled",    bg: "var(--tone-red-bg)", color: "var(--tone-red-fg)", border: "var(--tone-red-bd)" },

  // ── Neutral gray: user or auto cancel (voided paper)
  cancelled:          { label: "Cancelled",    bg: "var(--tone-gray-bg)", color: "var(--tone-gray-fg)", border: "var(--tone-gray-bd)" },
  cancelled_by_user:  { label: "Cancelled",    bg: "var(--tone-gray-bg)", color: "var(--tone-gray-fg)", border: "var(--tone-gray-bd)" },
  auto_cancelled:     { label: "Expired",      bg: "var(--tone-gray-bg)", color: "var(--tone-gray-fg)", border: "var(--tone-gray-bd)" },
};

/** Fallback for unknown statuses */
export const BADGE_FALLBACK: BadgeToken = { label: "", bg: "var(--tone-gray-bg)", color: "var(--tone-gray-fg)", border: "var(--tone-gray-bd)" };

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
