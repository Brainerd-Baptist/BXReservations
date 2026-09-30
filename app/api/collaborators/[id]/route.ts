import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { deliverInvite } from "@/lib/collab-invite";

interface RouteContext { params: Promise<{ id: string }> }

/** Load the invite and decide what the caller may do with it. */
async function load(collabId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) } as const;
  const db = adminClient();
  const { data: collab } = await db
    .from("reservation_collaborators")
    .select("id, reservation_id, user_id, invited_by, invited_email, collab_role")
    .eq("id", collabId).maybeSingle();
  if (!collab) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const ctx = await getEventMapContext(db, user, collab.reservation_id);
  const manager = !!ctx && ctx.access === "edit";            // organizer, co-organizer, staff
  const self = collab.user_id === user.id || collab.invited_email === (user.email ?? "").toLowerCase();
  const { data: prof } = await db.from("bx_user_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  return { db, user, collab, manager, self, name: (prof?.display_name as string | undefined) ?? user.email ?? "A team member" } as const;
}

// DELETE — remove someone (organizer/co-organizer/staff), or leave (yourself)
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const c = await load(id);
  if ("error" in c) return c.error;
  if (!c.manager && !c.self) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { error } = await c.db.from("reservation_collaborators").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't remove them" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH { role } — switch between co-organizer and viewer
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const c = await load(id);
  if ("error" in c) return c.error;
  if (!c.manager) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { role } = await req.json().catch(() => ({})) as { role?: string };
  if (role !== "co_owner" && role !== "viewer") return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const { error } = await c.db.from("reservation_collaborators").update({ collab_role: role }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST — send the invitation email again
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const c = await load(id);
  if ("error" in c) return c.error;
  if (!c.manager) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const r = await deliverInvite(c.db, id, c.name);
  if (!r.ok) return NextResponse.json({ error: `The email didn't send: ${r.error}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
