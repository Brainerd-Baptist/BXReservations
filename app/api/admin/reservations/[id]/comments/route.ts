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
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
}

async function requireAdmin(sb: Awaited<ReturnType<typeof sbServer>>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient()
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

// GET /api/admin/reservations/[id]/comments — all comments (inc internal)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: res } = await adminClient()
    .from("reservations")
    .select("id")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: comments, error } = await adminClient()
    .from("reservation_comments")
    .select("id, author_name, author_role, body, internal_only, created_at, updated_at")
    .eq("reservation_id", res.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(comments ?? []);
}

// POST /api/admin/reservations/[id]/comments — admin posts a comment
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = (body.body ?? "").trim();
  const internalOnly = body.internal_only === true;
  if (!text) return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "Comment too long (max 4000 chars)." }, { status: 400 });

  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, user_id")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Author name
  const { data: profile } = await adminClient()
    .from("bx_user_profiles")
    .select("display_name")
    .eq("user_id", actor.user.id)
    .maybeSingle();
  const authorName = profile?.display_name ?? actor.user.email ?? "BX Team";

  const { data: comment, error } = await adminClient()
    .from("reservation_comments")
    .insert({
      reservation_id: res.id,
      author_id: actor.user.id,
      author_name: authorName,
      author_role: "admin",
      body: text,
      internal_only: internalOnly,
    })
    .select("id, author_name, author_role, body, internal_only, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write history row
  await adminClient().from("reservation_history").insert({
    reservation_id: res.id,
    actor_id:       actor.user.id,
    actor_name:     authorName,
    actor_role:     "admin",
    action:         "comment",
    note:           text.slice(0, 500),
    metadata:       { internal_only: internalOnly },
  });

  // Notify user if not internal
  if (!internalOnly && res.contact_email) {
    try {
      await sendEmail({
        to: res.contact_email,
        subject: `Update on your reservation${res.booking_number ? ` (${res.booking_number})` : ""}`,
        html: `
          <p>Hi ${res.contact_name ?? "there"},</p>
          <p>The BX team left a message on your reservation${res.event_name ? ` <em>${res.event_name}</em>` : ""}:</p>
          <blockquote style="border-left:3px solid #C5A95A;padding-left:1em;color:#555;">${text.replace(/\n/g, "<br>")}</blockquote>
          <p><a href="https://bx.brainerdhq.app/reservations/${res.id}">View your reservation</a></p>
          <p style="color:#888;font-size:0.875em;">Brainerd Baptist &mdash; BX Reservations</p>
        `,
      });
    } catch (e) {
      console.error("[admin comments] user notify failed:", e);
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
