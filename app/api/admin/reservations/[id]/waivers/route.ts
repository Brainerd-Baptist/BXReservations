import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { getUserAndRole } from "@/lib/get-user-role";
import { readWaived, WAIVER_LABEL } from "@/lib/waivers";
import { releaseReward, syncRewardDiscount } from "@/lib/survey";

type Params = { params: Promise<{ id: string }> };

// PATCH { church_use?, waived? } — staff change what a booking needs (C4)
export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { church_use?: unknown; waived?: unknown };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.church_use === "boolean") patch.church_use = b.church_use;
  const w = b.waived !== undefined ? readWaived(b.waived) : null;
  if (w) patch.waived = Object.fromEntries(Object.entries(w).filter(([, v]) => v));

  const db = adminClient();
  const { data: before } = await db.from("reservations").select("status").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await db.from("reservations").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // No payment needed → the survey thank-you goes back for a later booking; otherwise keep its line current
  if (w?.payment) await releaseReward(db, id).catch(() => {});
  else await syncRewardDiscount(db, id).catch(() => {});

  const { user, profile } = await getUserAndRole();
  const skipped = w ? (Object.keys(w) as (keyof typeof w)[]).filter((k) => w[k]).map((k) => WAIVER_LABEL[k]) : [];
  await db.from("reservation_history").insert({
    reservation_id: id, actor_id: user?.id ?? null, actor_name: profile?.display_name || user?.email || "BX staff", actor_role: "admin",
    action: "requirements_changed", from_status: before.status, to_status: before.status,
    note: `${typeof b.church_use === "boolean" ? (b.church_use ? "Church use. " : "Not church use. ") : ""}${w ? (skipped.length ? `Not needed: ${skipped.join(", ")}.` : "Agreement, insurance and payment all needed.") : ""}`.trim(),
  });
  return NextResponse.json({ ok: true });
}
