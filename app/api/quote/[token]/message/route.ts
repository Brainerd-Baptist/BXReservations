import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";
import { rateLimit, clientIp, HOUR } from "@/lib/rate-limit";
import { isStaffPreview, loadQuote, postGuestMessage, QuoteError } from "@/lib/quotes";

type Params = { params: Promise<{ token: string }> };

// POST { text } — a question from the quote page, into the booking's Messages
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const limited = await rateLimit("quote-message", [{ key: clientIp(req), max: 30, windowSec: HOUR }, { key: token, max: 15, windowSec: HOUR }]);
  if (limited) return limited;
  const db = adminClient();
  const loaded = await loadQuote(db, token);
  if (!loaded) return NextResponse.json({ error: "This quote link isn't valid." }, { status: 404 });
  if (await isStaffPreview(db, loaded.reservation)) {
    return NextResponse.json({ error: "Reply from the booking in Admin — this is your staff preview." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = (typeof body.text === "string" ? body.text : "").trim();
  if (text.length < 2) return NextResponse.json({ error: "Type your question first." }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "That's a bit long — keep it under 4,000 characters." }, { status: 400 });
  try {
    await postGuestMessage(db, loaded.reservation, `About quote v${loaded.quote.version}: ${text}`, { headline: "Question about a quote" });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof QuoteError ? e.status : 500 });
  }
}
