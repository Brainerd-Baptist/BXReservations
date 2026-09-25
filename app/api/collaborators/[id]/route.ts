import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id: collaboratorId } = await ctx.params;

  if (!collaboratorId) {
    return NextResponse.json({ error: "Missing collaborator id" }, { status: 400 });
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Fetch the collaborator row to verify caller has permission ────────────
  const { data: collab, error: fetchErr } = await supabase
    .from("reservation_collaborators")
    .select("id, reservation_id, user_id, invited_by")
    .eq("id", collaboratorId)
    .single();

  if (fetchErr || !collab) {
    return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
  }

  // ── Authorization: must be reservation owner, the invited_by user,
  //    or the collaborator themselves (removing themselves) ─────────────────
  const { data: reservation } = await supabase
    .from("reservations")
    .select("submitter_id")
    .eq("id", collab.reservation_id)
    .single();

  const isResOwner = reservation?.submitter_id === user.id;
  const isInviter = collab.invited_by === user.id;
  const isSelf = collab.user_id === user.id;

  if (!isResOwner && !isInviter && !isSelf) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const { error: deleteErr } = await supabase
    .from("reservation_collaborators")
    .delete()
    .eq("id", collaboratorId);

  if (deleteErr) {
    console.error("[collaborators/:id] delete error:", deleteErr);
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
