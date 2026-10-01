import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";
import { loadQuote, quotePdf } from "@/lib/quotes";

type Params = { params: Promise<{ token: string }> };

// GET — the itemized quote PDF (with the signature once approved). The private link is the key.
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const db = adminClient();
  const loaded = await loadQuote(db, token);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { bytes, filename } = await quotePdf(db, loaded.quote, loaded.reservation);
  const inline = req.nextUrl.searchParams.get("download") !== "1";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
