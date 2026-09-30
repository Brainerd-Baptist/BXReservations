import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { buildInvoice } from "@/lib/invoice";

type Params = { params: Promise<{ id: string }> };

// GET — the itemized invoice (or paid receipt) PDF, for anyone who can see the booking
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const db = adminClient();
  const ctx = await getEventMapContext(db, user, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inv = await buildInvoice(db, ctx.reservation.id);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inline = req.nextUrl.searchParams.get("download") !== "1";
  return new NextResponse(Buffer.from(inv.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${inv.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
