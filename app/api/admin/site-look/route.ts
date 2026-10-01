import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient } from "@/lib/event-map";
import { getSiteLook, SITE_LOOK_TAG } from "@/lib/site-look";
import { cleanTheme } from "@/lib/site-theme";

async function requireOwner() {
  const { user, role } = await getUserAndRole();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  return null;
}

// GET — current site-wide background grid (Owner)
export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  return NextResponse.json(await getSiteLook());
}

// POST { gridDots?, gridLines? } — applies to every visitor
export async function POST(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as { gridDots?: boolean; gridLines?: boolean; theme?: unknown };
  const rows: { key: string; value: string }[] = [];
  if (typeof body.gridDots === "boolean") rows.push({ key: "grid_dots", value: body.gridDots ? "on" : "off" });
  if (typeof body.gridLines === "boolean") rows.push({ key: "grid_lines", value: body.gridLines ? "on" : "off" });
  if (body.theme !== undefined) rows.push({ key: "site_theme", value: JSON.stringify(cleanTheme(body.theme)) });
  if (!rows.length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const { error } = await adminClient().from("bx_settings").upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag(SITE_LOOK_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json(await getSiteLook());
}
