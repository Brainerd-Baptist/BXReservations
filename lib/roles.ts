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
  | "member";

/** Collaborator role on a specific reservation (not a system-wide role) */
export type CollabRole = "co_owner" | "viewer";

// ----------------------------------------------------------------
// Hierarchy
// ----------------------------------------------------------------

/** Numeric rank — higher = more privileged */
export const ROLE_RANK: Record<BxRole, number> = {
  owner: 5,
  system_admin: 4,
  booking_admin: 3,
  ministry_coordinator: 2,
  member: 1,
};

/** Ordered list from most to least privileged */
export const ROLES_ORDERED: BxRole[] = [
  "owner",
  "system_admin",
  "booking_admin",
  "ministry_coordinator",
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
};

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
