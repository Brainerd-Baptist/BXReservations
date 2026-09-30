import type { SupabaseClient } from "@supabase/supabase-js";
import { sendCollaboratorInvite } from "@/lib/email";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app").replace(/\/$/, "");

/** Send (or re-send) one invitation email and record whether it went out. */
export async function deliverInvite(db: SupabaseClient, collabId: string, inviterName: string): Promise<{ ok: boolean; error?: string }> {
  const { data: c } = await db
    .from("reservation_collaborators")
    .select("id, invited_email, collab_role, invite_token, reservations(event_name)")
    .eq("id", collabId)
    .maybeSingle();
  if (!c) return { ok: false, error: "Invitation not found" };
  const eventName = ((c.reservations as { event_name?: string } | null)?.event_name ?? "a reservation") as string;
  try {
    await sendCollaboratorInvite({
      to: c.invited_email, inviterName, eventName,
      role: c.collab_role as "co_owner" | "viewer",
      acceptUrl: `${SITE}/account/invites?token=${c.invite_token}`,
    });
    await db.from("reservation_collaborators").update({ invite_sent_at: new Date().toISOString(), invite_error: null }).eq("id", c.id);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    console.error("[invite] email failed:", c.invited_email, msg);
    await db.from("reservation_collaborators").update({ invite_error: msg }).eq("id", c.id);
    return { ok: false, error: msg };
  }
}
