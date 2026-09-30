import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";
import { requireStaff, requireSysadmin } from "@/lib/api-auth";

const UNITS = ["each", "per_day", "flat"];

function clean(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (typeof body.name === "string") out.name = body.name.trim().slice(0, 120);
  if (typeof body.description === "string") out.description = body.description.trim().slice(0, 500) || null;
  if (typeof body.unit === "string" && UNITS.includes(body.unit)) out.unit = body.unit;
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p < 0) throw new Error("Price must be zero or more.");
    out.price = Math.round(p * 100) / 100;
  }
  if (typeof body.active === "boolean") out.active = body.active;
  if (body.sort !== undefined && Number.isFinite(Number(body.sort))) out.sort = Math.trunc(Number(body.sort));
  return out;
}

// GET — full catalog including hidden items (staff)
export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  const { data, error } = await adminClient().from("bx_addons").select("*").order("sort").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — create (Owner / System Admin)
export async function POST(req: NextRequest) {
  const denied = await requireSysadmin();
  if (denied) return denied;
  try {
    const row = clean(await req.json());
    if (!row.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const { data, error } = await adminClient().from("bx_addons").insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// PATCH — update { id, ...fields } (Owner / System Admin). Hide with active:false.
export async function PATCH(req: NextRequest) {
  const denied = await requireSysadmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const row = { ...clean(body), updated_at: new Date().toISOString() };
    const { data, error } = await adminClient().from("bx_addons").update(row).eq("id", body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
