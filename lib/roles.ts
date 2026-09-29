/**
 * BX Reservations — Role utilities
 *
 * Single source of truth for role hierarchy, labels, and permission checks.
 * Used on both client and server.
 */

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type BxRole =
  | "owner"
  | "system_admin"
  | "booking_admin"
  | "ministry_coordinator"
  | "brainerd_staff"
  | "member";

/** Collaborator role on a specific reservation (not a system-wide role) */
export type CollabRole = "co_owner" | "viewer";

// ----------------------------------------------------------------
// Hierarchy
// ----------------------------------------------------------------

/** Numeric rank — higher = more privileged */
export const ROLE_RANK: Record<BxRole, number> = {
  owner: 6,
  system_admin: 5,
  booking_admin: 4,
  ministry_coordinator: 3,
  brainerd_staff: 2,
  member: 1,
};

/** Ordered list from most to least privileged */
export const ROLES_ORDERED: BxRole[] = [
  "owner",
  "system_admin",
  "booking_admin",
  "ministry_coordinator",
  "brainerd_staff",
  "member",
];

// ----------------------------------------------------------------
// Display
// ----------------------------------------------------------------

export const ROLE_LABELS: Record<BxRole, string> = {
  owner: "Owner",
  system_admin: "System Admin",
  booking_admin: "Booking Admin",
  ministry_coordinator: "Ministry Coordinator",
  brainerd_staff: "Brainerd Staff",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<BxRole, string> = {
  owner:
    "Full access including billing, impersonation, and app configuration.",
  system_admin:
    "Configure rooms, pricing, blackout rules, and manage users.",
  booking_admin:
    "Approve and deny reservations, view all bookings, message requesters.",
  ministry_coordinator:
    "Book for their ministry, view ministry reservation history.",
  brainerd_staff:
    "Church staff: book outside public windows, no COI or agreement required, 100% discount auto-applied. Reservations still require booking admin approval.",
  member: "Book for themselves, view their own reservation history.",
};

export const COLLAB_ROLE_LABELS: Record<CollabRole, string> = {
  co_owner: "Co-owner",
  viewer: "Viewer",
};

export const COLLAB_ROLE_DESCRIPTIONS: Record<CollabRole, string> = {
  co_owner:
    "Can view, edit, message admin, cancel, and receive all notifications.",
  viewer:
    "Can view reservation details and receive confirmation emails only.",
};

// ----------------------------------------------------------------
// Permission checks
// ----------------------------------------------------------------

/**
 * True if `userRole` is at or above `minRole` in the hierarchy.
 * Pass null/undefined for unauthenticated users — always returns false.
 */
export function hasRole(
  userRole: BxRole | null | undefined,
  minRole: BxRole
): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

/** Shorthand role checks */
export const can = {
  viewAdminPanel: (role: BxRole | null) => hasRole(role, "booking_admin"),
  approveReservations: (role: BxRole | null) => hasRole(role, "booking_admin"),
  configureSystem: (role: BxRole | null) => hasRole(role, "system_admin"),
  manageUsers: (role: BxRole | null) => hasRole(role, "system_admin"),
  deleteUser:   (role: BxRole | null) => hasRole(role, "system_admin"),
  manageMinistries: (role: BxRole | null) => hasRole(role, "system_admin"),
  impersonate: (role: BxRole | null) => role === "owner",
  assignRole: (
    assignerRole: BxRole | null,
    targetRole: BxRole
  ): boolean => {
    if (!assignerRole) return false;
    if (assignerRole === "owner") return true;
    // system_admin can assign up to booking_admin
    if (assignerRole === "system_admin") {
      return ROLE_RANK[targetRole] <= ROLE_RANK["booking_admin"];
    }
    return false;
  },
  bookOnBehalfOf: (role: BxRole | null) =>
    hasRole(role, "ministry_coordinator"),

  // ── Brainerd Staff privileges ──────────────────────────────────
  /** May submit reservations outside the public booking window (weekends, Wed nights). */
  bookOutsideWindow: (role: BxRole | null) => role === "brainerd_staff" || hasRole(role, "booking_admin"),
  /** COI upload is not required for this user's reservations. */
  skipCoi: (role: BxRole | null) => role === "brainerd_staff" || hasRole(role, "booking_admin"),
  /** Agreement signing is not required for this user's reservations. */
  skipAgreement: (role: BxRole | null) => role === "brainerd_staff" || hasRole(role, "booking_admin"),
  /** Reservation should be surfaced at the top of the admin queue with a "Staff Event" badge. */
  fastTrackQueue: (role: BxRole | null) => role === "brainerd_staff",
  /** 100% discount is automatically applied to this user's reservations. */
  autoFullDiscount: (role: BxRole | null) => role === "brainerd_staff",
};

// ----------------------------------------------------------------
// Reservation flag helpers
// ----------------------------------------------------------------

/**
 * Given a requester's role, return the set of reservation flags that
 * should be applied at booking-creation time.
 *
 * These flags are stored on the reservation record so the booking engine
 * and admin UI can act on them without re-checking role at every step.
 */
export function reservationFlagsForRole(role: BxRole | null): {
  requires_coi: boolean;
  requires_agreement: boolean;
  booking_window_exempt: boolean;
  fast_track: boolean;
  staff_discount: boolean;
} {
  return {
    requires_coi: !can.skipCoi(role),
    requires_agreement: !can.skipAgreement(role),
    booking_window_exempt: can.bookOutsideWindow(role),
    fast_track: can.fastTrackQueue(role),
    staff_discount: can.autoFullDiscount(role),
  };
}

// ----------------------------------------------------------------
// Server-side helpers (Supabase)
// ----------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

/** Fetch a user's BX role from the DB. Returns null if no row found. */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<BxRole | null> {
  const { data } = await supabase
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return (data?.role as BxRole) ?? null;
}

/** Fetch the calling user's role (uses supabase client with active session). */
export async function getMyRole(
  supabase: SupabaseClient
): Promise<BxRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserRole(supabase, user.id);
}

/** Ensure the calling user has at least `minRole`; throws if not. */
export async function requireRole(
  supabase: SupabaseClient,
  minRole: BxRole
): Promise<BxRole> {
  const role = await getMyRole(supabase);
  if (!hasRole(role, minRole)) {
    throw new Error(
      `Insufficient permissions. Required: ${ROLE_LABELS[minRole]}.`
    );
  }
  return role!;
}
