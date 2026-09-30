import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { sendEmail, brandedEmailHtml } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

async function sbServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Reservation id from a uuid or booking number. */
async function resolveId(id: string): Promise<string | null> {
  if (UUID.test(id)) return id;
  const { data } = await adminClient().from("reservations").select("id").eq("booking_number", id).maybeSingle();
  return data?.id ?? null;
}

// GET /api/reservations/[id]/comments — returns non-internal comments for this reservation
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Staff, the requester (account or booking email) or an accepted collaborator
  const resId = await resolveId(id);
  const ctx = resId ? await getEventMapContext(adminClient(), user, resId) : null;
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const res = ctx.reservation;

  const { data: comments, error } = await adminClient()
    .from("reservation_comments")
    .select("id, author_name, author_role, body, created_at")
    .eq("reservation_id", res.id)
    .eq("internal_only", false)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(comments ?? []);
}

// POST /api/reservations/[id]/comments — user posts a comment
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "Comment too long (max 4000 chars)." }, { status: 400 });

  const resId = await resolveId(id);
  const ctx = resId ? await getEventMapContext(adminClient(), user, resId) : null;
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, user_id, booking_number, event_name, contact_name, contact_email")
    .eq("id", ctx.reservation.id)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Staff writing from the booking page post as the BX team, like the admin screen.
  const asStaff = ctx.staff;
  if (!asStaff && ctx.access !== "edit") {
    return NextResponse.json({ error: "Viewers can read messages but can't send them." }, { status: 403 });
  }

  // Get author display name
  const { data: profile } = await adminClient()
    .from("bx_user_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const authorName = profile?.display_name ?? res.contact_name ?? user.email ?? "Guest";

  const { data: comment, error } = await adminClient()
    .from("reservation_comments")
    .insert({
      reservation_id: res.id,
      author_id: user.id,
      author_name: authorName,
      author_role: asStaff ? "admin" : "user",
      body: text,
      internal_only: false,
    })
    .select("id, author_name, author_role, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write history row
  await adminClient().from("reservation_history").insert({
    reservation_id: res.id,
    actor_id:       user.id,
    actor_name:     authorName,
    actor_role:     asStaff ? "admin" : "user",
    action:         "comment",
    note:           text.slice(0, 500),
  });

  // Staff message → email the requester; requester message → email staff
  if (asStaff) {
    if (res.contact_email) {
      const ref = res.booking_number ?? res.id.slice(0, 8);
      await sendEmail({
        to: res.contact_email,
        subject: `New message about your reservation ${ref}`,
        html: brandedEmailHtml({
          headline: "A message from the BX team",
          body: `
            <p style="margin:0 0 8px 0;"><strong style="color:#00205b;">${esc(authorName)}</strong> wrote about
              <strong style="color:#00205b;">${esc(ref)}</strong>${res.event_name ? ` — ${esc(res.event_name)}` : ""}:</p>
            <p style="margin:0 0 20px 0; padding:12px 16px; background-color:#f3f4f6; border-radius:8px; color:#374151;">${esc(text).replace(/\n/g, "<br>")}</p>`,
          ctaText: "View and reply",
          ctaUrl: `https://bx.brainerdhq.app/reservations/${res.id}`,
          footnoteHtml: null,
        }),
      }).catch((e) => console.error("[comments] requester notify failed:", e));
    }
    return NextResponse.json(comment, { status: 201 });
  }

  // Notify admins
  try {
    const { data: admins } = await adminClient()
      .from("bx_user_roles")
      .select("user_id")
      .in("role", ["owner", "system_admin", "booking_admin"]);

    if (admins?.length) {
      const adminIds = admins.map((a: { user_id: string }) => a.user_id);
      const { data: adminProfiles } = await adminClient()
        .from("bx_user_profiles")
        .select("display_name, user_id")
        .in("user_id", adminIds);

      // Fetch emails for each admin individually (avoids expensive listUsers())
      const adminEmailResults = await Promise.all(
        adminIds.map((uid: string) => adminClient().auth.admin.getUserById(uid))
      );
      const adminEmails = adminEmailResults
        .map((r) => r.data?.user?.email)
        .filter(Boolean) as string[];

      for (const email of adminEmails.slice(0, 5)) {
        await sendEmail({
          to: email as string,
          subject: `New comment on reservation ${res.booking_number ?? res.id.slice(0, 8)}`,
          html: brandedEmailHtml({
            headline: "New Comment on Reservation",
            body: `
              <p style="margin:0 0 8px 0;">
                <strong style="color:#00205b;">${esc(authorName)}</strong> left a comment on reservation
                <strong style="color:#00205b;">${esc(res.booking_number ?? res.id.slice(0, 8))}</strong>${res.event_name ? ` — ${esc(res.event_name)}` : ""}:
              </p>
              <p style="margin:0 0 20px 0; padding:12px 16px; background-color:#f3f4f6; border-radius:8px; color:#374151;">
                ${esc(text).replace(/\n/g, "<br>")}
              </p>
            `,
            ctaText: "View in Admin Dashboard",
            ctaUrl: "https://bx.brainerdhq.app/admin/bx-reservations",
            footnoteHtml: null,
          }),
        });
      }
    }
  } catch (e) {
    console.error("[comments] admin notify failed:", e);
  }

  return NextResponse.json(comment, { status: 201 });
}
