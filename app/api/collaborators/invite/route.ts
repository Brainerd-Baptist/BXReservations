import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface InviteBody {
  reservationId: string;
  email: string;
  role: "co_owner" | "viewer";
}

export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { reservationId, email, role } = body;

  if (!reservationId || !email || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["co_owner", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const normalizedEmail = email.toLowerCase().trim();

  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Ownership check — caller must own (or co_own) the reservation ─────────
  const { data: reservation, error: resErr } = await supabase
    .from("reservations")
    .select("id, submitter_id")
    .eq("id", reservationId)
    .single();

  if (resErr || !reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const isOwner = reservation.submitter_id === user.id;

  if (!isOwner) {
    // Also allow co_owners
    const { data: collab } = await supabase
      .from("reservation_collaborators")
      .select("collab_role")
      .eq("reservation_id", reservationId)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .single();

    if (!collab || collab.collab_role !== "co_owner") {
      return NextResponse.json({ error: "Not authorized to invite" }, { status: 403 });
    }
  }

  // ── Guard: don't invite yourself ─────────────────────────────────────────
  if (normalizedEmail === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You can't invite yourself." },
      { status: 400 }
    );
  }

  // ── Guard: no duplicate pending invites ───────────────────────────────────
  const { data: existing } = await supabase
    .from("reservation_collaborators")
    .select("id")
    .eq("reservation_id", reservationId)
    .eq("invited_email", normalizedEmail)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "This person has already been invited." },
      { status: 409 }
    );
  }

  // ── Insert the invite ─────────────────────────────────────────────────────
  const token = crypto.randomUUID();

  const { error: insertErr } = await supabase
    .from("reservation_collaborators")
    .insert({
      reservation_id: reservationId,
      invited_email: normalizedEmail,
      collab_role: role,
      invite_token: token,
      invited_by: user.id,
    });

  if (insertErr) {
    console.error("[collaborators/invite] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  // ── TODO: send invite email ───────────────────────────────────────────────
  // When an email service is wired up, send a message containing:
  //   Accept link: <NEXT_PUBLIC_SITE_URL>/account/invites?token=<token>
  // For now the token is stored; the invitee can be given the link manually
  // or via a future Supabase Edge Function trigger.

  return NextResponse.json({ ok: true });
}
