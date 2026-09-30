import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { sendEmail, brandedEmailHtml } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const WHAT: Record<string, string> = { dates: "Dates", times: "Times", rooms: "Rooms", other: "Something else" };

/**
 * POST — organizer asks the BX team to change dates, times or rooms.
 * Saved as a message on the booking (so the conversation stays in one place)
 * and flagged to staff in the bell and by email.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const db = adminClient();
  const ctx = await getEventMapContext(db, user, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ctx.access !== "edit") return NextResponse.json({ error: "Only the organizer or a co-organizer can request changes." }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { what?: string[]; message?: string };
  const what = (Array.isArray(body.what) ? body.what : []).filter((w) => WHAT[w]);
  const message = (body.message ?? "").trim().slice(0, 2000);
  if (!message) return NextResponse.json({ error: "Describe the change you'd like." }, { status: 400 });

  const { data: r } = await db.from("reservations").select("id, booking_number, event_name").eq("id", ctx.reservation.id).single();
  const { data: prof } = await db.from("bx_user_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  const who = (prof?.display_name as string | undefined) ?? user.email ?? "The organizer";
  const label = what.length ? what.map((w) => WHAT[w]).join(", ") : "Schedule";
  const text = `Change request (${label}): ${message}`;

  const { error } = await db.from("reservation_comments").insert({
    reservation_id: ctx.reservation.id, author_id: user.id, author_name: who, author_role: "user", body: text, internal_only: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("reservation_history").insert({
    reservation_id: ctx.reservation.id, actor_id: user.id, actor_name: who, actor_role: "user", action: "change_requested", note: text.slice(0, 500),
  });

  const ref = r?.booking_number ?? ctx.reservation.id.slice(0, 8);
  after(async () => {
    try {
      const { data: admins } = await db.from("bx_user_roles").select("user_id").in("role", ["owner", "system_admin", "booking_admin"]);
      if (!admins?.length) return;
      await db.from("bx_notifications").insert(admins.map((a: { user_id: string }) => ({
        user_id: a.user_id, reservation_id: ctx.reservation.id, type: "change_request",
        title: "Change requested", body: `${who} asked to change ${label.toLowerCase()} on ${r?.event_name ?? "a booking"} (${ref}).`,
      })));
      const emails = (await Promise.all(admins.slice(0, 5).map((a: { user_id: string }) => db.auth.admin.getUserById(a.user_id))))
        .map((x) => x.data?.user?.email).filter(Boolean) as string[];
      for (const to of emails) {
        await sendEmail({
          to, subject: `Change requested — ${ref}`,
          html: brandedEmailHtml({
            headline: "Change requested",
            body: `<p style="margin:0 0 8px 0;"><strong>${esc(who)}</strong> asked to change <strong>${esc(label.toLowerCase())}</strong> on ${esc(r?.event_name ?? "a booking")} (${esc(ref)}):</p>
              <p style="margin:0 0 20px 0; padding:12px 16px; background-color:#f3f4f6; border-radius:8px; color:#374151;">${esc(message).replace(/\n/g, "<br>")}</p>`,
            ctaText: "Open in the dashboard",
            ctaUrl: `https://bx.brainerdhq.app/admin/bx-reservations?open=${ctx.reservation.id}`,
            footnoteHtml: null,
          }),
        });
      }
    } catch (e) { console.error("[change-request] notify failed:", e); }
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
