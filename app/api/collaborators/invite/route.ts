import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { deliverInvite } from "@/lib/collab-invite";
import { rateLimit, HOUR } from "@/lib/rate-limit";

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
  const limited = await rateLimit("invite", [{ key: user.id, max: 40, windowSec: HOUR }]);
  if (limited) return limited;

  // ── Who may invite: the requester, an accepted co-owner, or staff ────────
  // Checked with the server key (the same rule the event map uses), so a
  // database hiccup can't masquerade as "Reservation not found".
  const db = adminClient();
  const ctx = await getEventMapContext(db, user, reservationId);
  if (!ctx) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }
  if (ctx.access !== "edit") {
    return NextResponse.json({ error: "Only the organizer or a co-organizer can invite people." }, { status: 403 });
  }
  const reservation = ctx.reservation;

  // ── Guard: don't invite yourself ─────────────────────────────────────────
  if (normalizedEmail === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "You can't invite yourself." }, { status: 400 });
  }

  // ── Guard: no duplicate pending invites ───────────────────────────────────
  const { data: existing } = await db
    .from("reservation_collaborators")
    .select("id")
    .eq("reservation_id", reservationId)
    .eq("invited_email", normalizedEmail)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This person has already been invited." }, { status: 409 });
  }

  // ── Insert the invite ─────────────────────────────────────────────────────
  const token = crypto.randomUUID();

  const { data: inserted, error: insertErr } = await db
    .from("reservation_collaborators")
    .insert({
      reservation_id: reservationId,
      invited_email:  normalizedEmail,
      collab_role:    role,
      invite_token:   token,
      invited_by:     user.id,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[collaborators/invite] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }


  // Fetch inviter display name
  const { data: inviterProfile } = await db
    .from("bx_user_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const inviterName = (inviterProfile?.display_name ?? user.email ?? "A team member") as string;

  // Send now (not after the response) so we can record whether it went out
  const sent = inserted ? await deliverInvite(db, inserted.id, inviterName) : { ok: false };

  return NextResponse.json({ ok: true, emailed: sent.ok });
}
