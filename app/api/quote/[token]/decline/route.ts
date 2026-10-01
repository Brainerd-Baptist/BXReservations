import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";
import { rateLimit, clientIp, HOUR } from "@/lib/rate-limit";
import { declineQuote, isStaffPreview, loadQuote, QuoteError } from "@/lib/quotes";

type Params = { params: Promise<{ token: string }> };

// POST { reason } — the organizer asks for changes instead of approving
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const limited = await rateLimit("quote-decline", [{ key: clientIp(req), max: 20, windowSec: HOUR }, { key: token, max: 5, windowSec: HOUR }]);
  if (limited) return limited;
  const db = adminClient();
  const pre = await loadQuote(db, token);
  if (pre && await isStaffPreview(db, pre.reservation)) {
    return NextResponse.json({ error: "Only the organizer can request changes. This is your staff preview." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  try {
    const q = await declineQuote(db, token, typeof body.reason === "string" ? body.reason : "");
    return NextResponse.json({ ok: true, declinedAt: q.declined_at });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof QuoteError ? e.status : 500 });
  }
}
