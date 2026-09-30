import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";

type Params = { params: Promise<{ id: string }> };

// GET — who else is on this booking (organizer, co-organizers, viewers)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const db = adminClient();
  const ctx = await getEventMapContext(db, user, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await db
    .from("reservation_collaborators")
    .select("id, invited_email, collab_role, accepted_at, created_at, invite_sent_at, invite_error, user_id")
    .eq("reservation_id", ctx.reservation.id)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    people: data ?? [],
    canManage: ctx.access === "edit",
    organizerEmail: ctx.reservation.contact_email ?? null,
  });
}
