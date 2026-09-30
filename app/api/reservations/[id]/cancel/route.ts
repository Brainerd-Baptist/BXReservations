import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { pcoCancelEvent } from "@/lib/pco";
import { notifyCancellation } from "@/lib/cancellation";
import { releaseReward } from "@/lib/survey";

// POST /api/reservations/[id]/cancel  { reason }
// The organizer or an accepted co-organizer cancels (C4). A reason is required,
// and everyone on the booking hears who cancelled, when and why.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = String(body.reason ?? "").trim().slice(0, 1000);
  if (reason.length < 3) return NextResponse.json({ error: "Please say why you're cancelling." }, { status: 400 });

  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const db = adminClient();
  const ctx = /^[0-9a-f-]{36}$/i.test(id) ? await getEventMapContext(db, user, id) : null;
  if (!ctx) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (ctx.access !== "edit") return NextResponse.json({ error: "Only the organizer or a co-organizer can cancel." }, { status: 403 });

  const { data: row } = await db
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, status, user_id, pco_event_id")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  const nonCancellable = ["completed", "confirmed", "cancelled", "cancelled_by_admin", "cancelled_by_user", "auto_cancelled"];
  if (nonCancellable.includes(row.status as string)) {
    return NextResponse.json(
      { error: row.status === "confirmed" ? "This booking is confirmed — message the BX team to cancel it." : "This booking can't be cancelled now." },
      { status: 409 }
    );
  }

  // Who, in words: "Jane Smith (co-organizer)"
  const { data: prof } = await db.from("bx_user_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  const name = (prof?.display_name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || user.email || "Someone";
  const isOrganizer = row.user_id === user.id || (row.contact_email ?? "").toLowerCase() === (user.email ?? "").toLowerCase();
  const { data: myCollab } = isOrganizer ? { data: null } : await db.from("reservation_collaborators")
    .select("collab_role").eq("reservation_id", id).eq("user_id", user.id).not("accepted_at", "is", null).maybeSingle();
  const isCoOrganizer = myCollab?.collab_role === "co_owner";
  // Staff cancel from Admin (it records the right status and emails the organizer)
  if (!isOrganizer && !isCoOrganizer) {
    return NextResponse.json({ error: "Staff: cancel this booking from the Admin panel." }, { status: 403 });
  }
  const roleWord = isOrganizer ? "organizer" : "co-organizer";
  const who = `${name} (${roleWord})`;
  const now = new Date().toISOString();

  const { error: updateErr } = await db.from("reservations").update({
    status: "cancelled_by_user", cancelled_by: who, cancellation_reason: reason, cancelled_at: now, updated_at: now,
  }).eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await releaseReward(db, id).catch(() => {}); // an unused survey thank-you goes back to them
  await db.from("reservation_history").insert({
    reservation_id: id, actor_id: user.id, actor_name: who, actor_role: isOrganizer ? "user" : "collaborator",
    action: "user_cancelled", from_status: row.status, to_status: "cancelled_by_user", note: reason,
  });

  if (row.pco_event_id) {
    after(() => pcoCancelEvent(row.pco_event_id as string).catch((err) => console.error("[pco] user-cancel tag error:", err)));
  }
  after(() => notifyCancellation(db, {
    reservation: { id: row.id as string, booking_number: row.booking_number as string | null, event_name: row.event_name as string | null, contact_email: row.contact_email as string | null, user_id: row.user_id as string | null },
    who, reason, actorUserId: user.id,
  }));

  return NextResponse.json({ ok: true });
}
