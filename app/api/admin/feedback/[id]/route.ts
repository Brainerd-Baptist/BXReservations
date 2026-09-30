import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { getUserAndRole } from "@/lib/get-user-role";

type Params = { params: Promise<{ id: string }> };

// PATCH { note } — mark a survey follow-up as done (staff)
export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { note?: string };
  const note = String(b.note ?? "").trim().slice(0, 2000);
  if (!note) return NextResponse.json({ error: "Add a short note about the follow-up." }, { status: 400 });
  const { user, profile } = await getUserAndRole();
  const { error } = await adminClient().from("bx_surveys").update({
    followed_up_at: new Date().toISOString(), followed_up_by: profile?.display_name || user?.email || "BX staff", followup_note: note,
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
