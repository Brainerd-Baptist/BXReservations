import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendStatusUpdateEmail } from "@/lib/email";
import { pcoCancelEvent } from "@/lib/pco";

// POST /api/reservations/[id]/cancel
// Allows an authenticated user to cancel their own reservation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { reason } = (await req.json()) as { reason?: string };

  // Authenticate the caller
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: row, error: fetchErr } = await supabase
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, status, user_id, pco_event_id")
    .eq("id", id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Only the owner can self-cancel
  const isOwner =
    row.user_id === user.id ||
    (row.contact_email ?? "").toLowerCase() === (user.email ?? "").toLowerCase();
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cannot cancel once confirmed, completed, or already cancelled
  const nonCancellable = ["completed", "confirmed", "cancelled", "cancelled_by_admin", "cancelled_by_user", "auto_cancelled"];
  if (nonCancellable.includes(row.status as string)) {
    return NextResponse.json(
      { error: `Cannot cancel a reservation with status: ${row.status}` },
      { status: 409 }
    );
  }

  const prevStatus = row.status as string;
  const displayName = (user.user_metadata?.full_name as string) ?? (user.email ?? "Unknown");

  const { error: updateErr } = await supabase
    .from("reservations")
    .update({
      status:              "cancelled_by_user",
      cancelled_by:         displayName,
      cancellation_reason: reason ?? null,
      cancelled_at:        new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // ── PCO Calendar tag → Canceled (non-blocking) ────────────────────────────
  if (row.pco_event_id) {
    pcoCancelEvent(row.pco_event_id as string).catch(
      err => console.error("[pco] user-cancel tag error:", err)
    );
  }

  // Explicit history row with user details (trigger also fires a minimal row)
  await supabase.from("reservation_history").insert({
    reservation_id: id,
    actor_id:       user.id,
    actor_name:     displayName,
    actor_role:     "user",
    action:         "user_cancelled",
    from_status:    prevStatus,
    to_status:      "cancelled_by_user",
    note:           reason ?? null,
  });

  // Notify all admins
  const { data: adminRoles } = await supabase
    .from("bx_user_roles")
    .select("user_id")
    .in("role", ["owner", "system_admin", "booking_admin"]);

  if (adminRoles && adminRoles.length > 0) {
    const notifs = adminRoles.map((r: { user_id: string }) => ({
      user_id:        r.user_id,
      reservation_id: id,
      type:           "status_update",
      title:          "Reservation cancelled by requester",
      body:           `${displayName} cancelled ${row.event_name as string} (${row.booking_number as string})${reason ? ": " + reason : "."}`,
    }));
    await supabase.from("bx_notifications").insert(notifs);
  }

  // Confirmation email to the user
  if (row.contact_email) {
    sendStatusUpdateEmail({
      to:            row.contact_email as string,
      name:          (row.contact_name as string) || (row.contact_email as string),
      bookingNumber: row.booking_number as string,
      reservationId: id,
      eventName:     row.event_name as string,
      newStatus:     "cancelled_by_user",
      adminNote:     reason,
    }).catch(err => console.error("[email] cancel-by-user failed:", err));
  }

  return NextResponse.json({ ok: true });
}
