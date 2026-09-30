import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

// PATCH { name?, description?, org_id? } — rename or change who sees it (staff)
export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; description?: string | null; org_id?: string | null };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.name !== undefined) {
    const name = String(b.name).trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
    patch.name = name;
  }
  if (b.description !== undefined) patch.description = String(b.description ?? "").trim().slice(0, 300) || null;
  if (b.org_id !== undefined) patch.org_id = b.org_id && UUID.test(b.org_id) ? b.org_id : null;
  const { error } = await adminClient().from("bx_booking_templates").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — retire a template (kept for history, hidden everywhere)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await adminClient().from("bx_booking_templates").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
