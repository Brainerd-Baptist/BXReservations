import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { getUserAndRole } from "@/lib/get-user-role";
import { describePattern, patternFromPayload, sanitizePattern } from "@/lib/booking-pattern";

const UUID = /^[0-9a-f-]{36}$/i;

// GET /api/admin/templates — every active booking template (staff)
export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  const { data, error } = await adminClient()
    .from("bx_booking_templates")
    .select("id, name, description, org_id, pattern, source_reservation_id, created_at, bx_organizations(name)")
    .eq("active", true)
    .order("sort_order").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((t) => {
    const p = sanitizePattern(t.pattern);
    const org = Array.isArray(t.bx_organizations) ? t.bx_organizations[0] : t.bx_organizations;
    return { id: t.id, name: t.name, description: t.description, org_id: t.org_id, org_name: (org as { name?: string } | null)?.name ?? null, summary: p ? describePattern(p) : "—", source_reservation_id: t.source_reservation_id };
  }));
}

// POST { name, description?, org_id?, reservationId } — save a booking's
// spaces, setup, time and headcount as a template (staff)
export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { user } = await getUserAndRole();
  const b = (await req.json().catch(() => ({}))) as { name?: string; description?: string; org_id?: string | null; reservationId?: string };
  const name = String(b.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
  if (!b.reservationId || !UUID.test(b.reservationId)) return NextResponse.json({ error: "Choose a booking to copy." }, { status: 400 });
  const orgId = b.org_id && UUID.test(b.org_id) ? b.org_id : null;

  const db = adminClient();
  const { data: res } = await db.from("reservations").select("id, payload").eq("id", b.reservationId).maybeSingle();
  if (!res) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const { data: charges } = await db.from("reservation_charges").select("addon_id, quantity").eq("reservation_id", res.id).eq("kind", "addon");
  const addons: Record<string, number> = {};
  for (const c of charges ?? []) if (c.addon_id) addons[c.addon_id as string] = (addons[c.addon_id as string] ?? 0) + Number(c.quantity ?? 1);
  const pattern = patternFromPayload(res.payload, addons);
  if (!pattern) return NextResponse.json({ error: "That booking has no spaces to copy." }, { status: 400 });
  // A template never carries the original renter's event name, notes or organization
  delete pattern.eventName;
  delete pattern.notes;
  delete pattern.org;
  delete pattern.isNonProfit;

  const { data, error } = await db.from("bx_booking_templates").insert({
    name, description: String(b.description ?? "").trim().slice(0, 300) || null,
    org_id: orgId, pattern, source_reservation_id: res.id, created_by: user?.id ?? null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, summary: describePattern(pattern) }, { status: 201 });
}
