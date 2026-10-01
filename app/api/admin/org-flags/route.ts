// ─── Admin: org flag queue ─────────────────────────────────────────────────
// GET  /api/admin/org-flags          – list unresolved flags
// POST /api/admin/org-flags          – resolve a flag (approve/merge/corrected/dismissed)
// POST /api/admin/org-flags?backfill – run the backfill pipeline

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";
import { backfillUnlinkedReservations } from "@/lib/org-match";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── GET: unresolved flags with reservation + org context ─────────────────
export async function GET(request: NextRequest) {
  const { user, role } = await getUserAndRole();
  if (!user || !can.viewAdminPanel(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const includeResolved = sp.get("resolved") === "1";

  const db = adminDb();
  let query = db
    .from("bx_org_flags")
    .select(`
      id, created_at, raw_text, flag_type, confidence, candidates,
      resolved_at, resolution,
      reservation_id,
      reservations!reservation_id (
        id, booking_number, contact_name, contact_email, event_name, status
      ),
      suggested_org_id,
      bx_organizations!suggested_org_id (
        id, name, tier, status
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!includeResolved) {
    query = query.is("resolved_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flags: data ?? [] });
}

// ─── POST: resolve a flag OR trigger backfill ──────────────────────────────
export async function POST(request: NextRequest) {
  const { user, role } = await getUserAndRole();
  if (!user || !can.viewAdminPanel(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?backfill=1 → run the backfill pipeline and return
  if (request.nextUrl.searchParams.get("backfill") === "1") {
    const db = adminDb();
    const result = await backfillUnlinkedReservations(db as never);
    return NextResponse.json({ backfill: result });
  }

  const body = await request.json();
  const { flag_id, resolution, organization_id } = body;

  if (!flag_id || !resolution) {
    return NextResponse.json({ error: "flag_id and resolution required" }, { status: 400 });
  }
  if (!["approved", "merged", "corrected", "dismissed"].includes(resolution)) {
    return NextResponse.json({ error: "Invalid resolution" }, { status: 400 });
  }

  const db = adminDb();

  // Fetch the flag to get reservation_id
  const { data: flag, error: fetchErr } = await db
    .from("bx_org_flags")
    .select("id, reservation_id, suggested_org_id")
    .eq("id", flag_id)
    .is("resolved_at", null)
    .single();

  if (fetchErr || !flag) {
    return NextResponse.json({ error: "Flag not found or already resolved" }, { status: 404 });
  }

  // If a specific org was chosen (approved / corrected / merged), link the reservation
  const targetOrgId = organization_id ?? flag.suggested_org_id;
  if (targetOrgId && flag.reservation_id && resolution !== "dismissed") {
    await db
      .from("reservations")
      .update({ organization_id: targetOrgId, org_match_method: "manual" })
      .eq("id", flag.reservation_id);
  }

  // Mark flag resolved
  const { error: resolveErr } = await db
    .from("bx_org_flags")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution,
    })
    .eq("id", flag_id);

  if (resolveErr) {
    return NextResponse.json({ error: resolveErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resolution });
}
