import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient, isStaffRole } from "@/lib/event-map";
import { sendEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

async function sbServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(ts) { try { ts.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } catch {} } } }
  );
}

async function requireAdmin(sb: Awaited<ReturnType<typeof sbServer>>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient().from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

// PATCH /api/admin/reservations/[id]/coi
// body: { action: "accept", expiry_date: "2027-06-01" } | { action: "flag", note: "Please fix..." }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb    = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => ({}));
  const action: string = body.action;
  if (!["accept", "flag"].includes(action)) {
    return NextResponse.json({ error: "action must be 'accept' or 'flag'" }, { status: 400 });
  }

  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, coi_file_url, coi_uploaded_at")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!res.coi_uploaded_at) return NextResponse.json({ error: "No COI uploaded yet." }, { status: 409 });

  const { data: profile } = await adminClient().from("bx_user_profiles").select("display_name").eq("user_id", actor.user.id).maybeSingle();
  const actorName = profile?.display_name ?? actor.user.email ?? "Admin";

  if (action === "accept") {
    const expiryDate: string | null = body.expiry_date ?? null;
    await adminClient().from("reservations").update({
      coi_accepted_at:  new Date().toISOString(),
      coi_accepted_by:  actorName,
      coi_expiry_date:  expiryDate,
    }).eq("id", res.id);

    await adminClient().from("reservation_history").insert({
      reservation_id: res.id,
      actor_id:       actor.user.id,
      actor_name:     actorName,
      actor_role:     "admin",
      action:         "document_accepted",
      note:           `COI accepted${expiryDate ? ` — expires ${expiryDate}` : ""}.`,
      metadata:       { expiry_date: expiryDate },
    });

    // Notify user
    if (res.contact_email) {
      await sendEmail({
        to: res.contact_email as string,
        subject: `COI received — reservation ${res.booking_number ?? (res.id as string).slice(0, 8)}`,
        html: `<p>Hi ${res.contact_name ?? "there"},</p><p>Your Certificate of Insurance has been reviewed and accepted. We'll be in touch with next steps.</p><p><a href="https://bx.brainerdhq.app/reservations/${res.id}">View your reservation</a></p>`,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, action: "accepted" });

  } else {
    // flag — post a comment and notify user
    const note: string = (body.note ?? "").trim() || "There is an issue with your Certificate of Insurance. Please review the requirements and re-upload.";
    await adminClient().from("reservation_comments").insert({
      reservation_id: res.id,
      author_id:       actor.user.id,
      author_name:     actorName,
      author_role:     "admin",
      body:            note,
      internal_only:   false,
    });
    await adminClient().from("reservation_history").insert({
      reservation_id: res.id,
      actor_id:       actor.user.id,
      actor_name:     actorName,
      actor_role:     "admin",
      action:         "comment",
      note:           `COI flagged: ${note}`.slice(0, 500),
    });
    if (res.contact_email) {
      await sendEmail({
        to: res.contact_email as string,
        subject: `Action needed on your COI — ${res.booking_number ?? (res.id as string).slice(0, 8)}`,
        html: `<p>Hi ${res.contact_name ?? "there"},</p><p>The BX team reviewed your Certificate of Insurance and has a note:</p><blockquote style="border-left:3px solid #C5A95A;padding-left:1em;">${note}</blockquote><p><a href="https://bx.brainerdhq.app/reservations/${res.id}">View your reservation and re-upload</a></p>`,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, action: "flagged" });
  }
}
