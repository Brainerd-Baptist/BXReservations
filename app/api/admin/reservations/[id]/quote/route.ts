import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";
import { getUserAndRole } from "@/lib/get-user-role";
import { isUuid } from "@/lib/reservation-id";
import { sendQuote } from "@/lib/quotes";

type Params = { params: Promise<{ id: string }> };

// POST { note? } — freeze the charges into a quote and email the organizer the approval link
export async function POST(req: NextRequest, { params }: Params) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { user, profile } = await getUserAndRole();
  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  try {
    const { quote, emailed } = await sendQuote(adminClient(), id, { id: user!.id, name: profile?.display_name || user!.email || "BX staff" }, {
      note: typeof body.note === "string" ? body.note : undefined,
    });
    if (!emailed) return NextResponse.json({ error: `Quote v${quote.version} was saved, but the email didn't send. The organizer can approve it from their booking page — or try again.` }, { status: 502 });
    return NextResponse.json({ ok: true, version: quote.version });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
