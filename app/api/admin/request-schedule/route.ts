import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendScheduleRequest } from "@/lib/email";

export async function POST(req: NextRequest) {
  // ── Auth: must be a signed-in BX admin ────────────────────────────────────
  const cookieStore = await cookies();
  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the caller is an admin
  const { data: roleRow } = await supabase
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "system_admin", "booking_admin"])
    .maybeSingle();

  if (!roleRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const { reservationId } = body as { reservationId?: string };
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }

  // ── Fetch reservation ──────────────────────────────────────────────────────
  const { data: res, error: fetchErr } = await supabase
    .from("reservations")
    .select("id, booking_number, contact_name, contact_email, event_name, schedule_requested_at, schedule_uploaded_at")
    .eq("id", reservationId)
    .single();

  if (fetchErr || !res) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // If already uploaded, no need to re-request
  if (res.schedule_uploaded_at) {
    return NextResponse.json({ skipped: "already_uploaded" });
  }

  // ── Generate a fresh upload token ──────────────────────────────────────────
  // We always issue a new token so admin can resend if the link expires or is lost.
  const { data: tokenData } = await supabase.rpc("gen_random_uuid") as { data: string | null };
  const uploadToken: string = tokenData ?? crypto.randomUUID();

  const { error: updateErr } = await supabase
    .from("reservations")
    .update({
      schedule_upload_token: uploadToken,
      schedule_requested_at: new Date().toISOString(),
    })
    .eq("id", reservationId);

  if (updateErr) {
    console.error("[schedule-request] update error:", updateErr);
    return NextResponse.json({ error: "Failed to generate upload token" }, { status: 500 });
  }

  // ── Send email ─────────────────────────────────────────────────────────────
  try {
    await sendScheduleRequest({
      to:            res.contact_email,
      name:          res.contact_name,
      bookingNumber: res.booking_number,
      eventName:     res.event_name,
      uploadToken,
    });
    console.log(`[schedule-request] email sent to ${res.contact_email} for ${res.booking_number}`);
  } catch (emailErr) {
    console.error("[schedule-request] email send failed:", emailErr);
    // Don't fail the request — the token is saved; admin can resend
    return NextResponse.json({
      sent: false,
      warning: "Token saved but email failed to send. You can resend from the admin panel.",
      requestedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    sent: true,
    to: res.contact_email,
    booking: res.booking_number,
    requestedAt: new Date().toISOString(),
  });
}
