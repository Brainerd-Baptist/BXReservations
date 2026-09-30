import { NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";

// GET /api/addons — the active add-on catalog (shown on the booking form)
export async function GET() {
  const { data, error } = await adminClient()
    .from("bx_addons")
    .select("id, name, description, unit, price, sort")
    .eq("active", true)
    .order("sort")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "public, s-maxage=60" } });
}
