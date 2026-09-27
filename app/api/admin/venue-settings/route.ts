import { NextRequest, NextResponse } from "next/server";
import { adminClient, isStaffRole } from "@/lib/event-map";
import { getUserAndRole } from "@/lib/get-user-role";
import { VENUE_KEYS, readVenue, type VenueKey } from "@/lib/venue";

// GET / PATCH /api/admin/venue-settings — the venue facts printed for attendees. Staff only.
async function requireStaff() {
  const { user, role } = await getUserAndRole();
  if (!user) return { denied: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (!isStaffRole(role)) return { denied: NextResponse.json({ error: "Staff only" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const r = await requireStaff();
  if ("denied" in r) return r.denied;
  return NextResponse.json({ venue: await readVenue(adminClient()) });
}

export async function PATCH(req: NextRequest) {
  const r = await requireStaff();
  if ("denied" in r) return r.denied;
  let body: { venue?: Partial<Record<VenueKey, string>> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const db = adminClient();
  for (const key of VENUE_KEYS) {
    const v = body.venue?.[key];
    if (typeof v !== "string") continue;
    const value = v.replace(/\r\n/g, "\n").trim().slice(0, key === "venue_maps_url" ? 500 : 1200);
    if (key === "venue_maps_url" && value && !/^https?:\/\//i.test(value)) {
      return NextResponse.json({ error: "The directions link must start with http:// or https://" }, { status: 422 });
    }
    const { error } = await db.from("bx_settings").upsert({ key, value, updated_by: r.user.email, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ venue: await readVenue(db) });
}
