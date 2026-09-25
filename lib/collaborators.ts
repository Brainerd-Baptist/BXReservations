/**
 * BX Reservations — Reservation collaboration utilities
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollabRole } from "./roles";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface ReservationCollaborator {
  id: string;
  reservation_id: string;
  user_id: string | null;
  collab_role: CollabRole;
  invited_email: string | null;
  invited_by: string | null;
  invite_token: string | null;
  accepted_at: string | null;
  created_at: string;
  /** Populated via join when fetching for display */
  display_name?: string;
}

// ----------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------

/** All collaborators on a reservation (owner / booking_admin only). */
export async function getCollaborators(
  supabase: SupabaseClient,
  reservationId: string
): Promise<ReservationCollaborator[]> {
  const { data, error } = await supabase
    .from("reservation_collaborators")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("created_at");

  if (error || !data) return [];
  return data as ReservationCollaborator[];
}

/** All reservations shared with the calling user as a collaborator. */
export async function getSharedReservations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("reservation_collaborators")
    .select("collab_role, reservations(*)")
    .not("accepted_at", "is", null);

  if (error || !data) return [];
  return data;
}

// ----------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------

/** Invite someone to collaborate on a reservation. */
export async function inviteCollaborator(
  supabase: SupabaseClient,
  reservationId: string,
  email: string,
  role: CollabRole
): Promise<{ error: string | null }> {
  // Generate a token for the invite link
  const token = crypto.randomUUID();

  const { error } = await supabase.from("reservation_collaborators").insert({
    reservation_id: reservationId,
    invited_email: email.toLowerCase().trim(),
    collab_role: role,
    invite_token: token,
  });

  if (error) return { error: error.message };

  // TODO: trigger invite email via API route /api/collaborators/invite
  // The email should include a link to:
  //   /account/invites?token=<token>
  // which accepts the invite and redirects to the reservation.

  return { error: null };
}

/** Accept a collaborator invite by token (used from invite link). */
export async function acceptInviteByToken(
  supabase: SupabaseClient,
  token: string
): Promise<{ reservationId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("reservation_collaborators")
    .update({ accepted_at: new Date().toISOString() })
    .eq("invite_token", token)
    .is("accepted_at", null)
    .select("reservation_id")
    .single();

  if (error || !data) return { reservationId: null, error: error?.message ?? "Invite not found or already accepted." };
  return { reservationId: data.reservation_id, error: null };
}

/** Remove a collaborator from a reservation. */
export async function removeCollaborator(
  supabase: SupabaseClient,
  collaboratorId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("reservation_collaborators")
    .delete()
    .eq("id", collaboratorId);

  return { error: error?.message ?? null };
}
