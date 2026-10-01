import { NextRequest, NextResponse, after } from "next/server";
import { adminClient } from "@/lib/event-map";
import { rateLimit, clientIp, HOUR } from "@/lib/rate-limit";
import { acceptQuote, isStaffPreview, loadQuote, quotePdf, QuoteError } from "@/lib/quotes";
import { sendQuoteApprovedEmails } from "@/lib/email";
import { readWaived } from "@/lib/waivers";

type Params = { params: Promise<{ token: string }> };

const NEXT_STEP: Record<string, string> = {
  pending_documents: "upload your certificate of insurance on your booking page.",
  pending_payment: "pay the balance — how to pay is on your booking page.",
};

// POST { name, agree: true } — the organizer approves the quote (and signs the agreement)
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const limited = await rateLimit("quote-accept", [{ key: clientIp(req), max: 20, windowSec: HOUR }, { key: token, max: 10, windowSec: HOUR }]);
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; agree?: unknown };
  if (body.agree !== true) return NextResponse.json({ error: "Check the box to approve." }, { status: 400 });
  const db = adminClient();
  // Staff can preview a quote they sent, but only the organizer approves it
  const pre = await loadQuote(db, token);
  if (pre && await isStaffPreview(db, pre.reservation)) {
    return NextResponse.json({ error: "Only the organizer or a co-organizer can approve this quote. This is your staff preview." }, { status: 403 });
  }
  try {
    const q = await acceptQuote(db, token, {
      name: typeof body.name === "string" ? body.name : "",
      ip: clientIp(req),
      ua: req.headers.get("user-agent") ?? "",
    });
    after(async () => {
      try {
        const loaded = await loadQuote(db, token);
        if (!loaded) return;
        const { reservation: r } = loaded;
        const pdf = await quotePdf(db, q, r);
        const next = NEXT_STEP[r.status] ?? (readWaived(r.waived).payment ? "the BX team will confirm your booking." : "watch your booking page for the next step.");
        const { data: admins } = await db.from("bx_user_roles").select("user_id").in("role", ["owner", "system_admin", "booking_admin"]);
        if (admins?.length) {
          await db.from("bx_notifications").insert(admins.map((a: { user_id: string }) => ({
            user_id: a.user_id, reservation_id: r.id, type: "quote_approved",
            title: "Quote approved", body: `${q.accepted_name} approved quote v${q.version} for ${r.event_name ?? "a booking"} (${r.booking_number ?? ""}).`,
          })));
        }
        await sendQuoteApprovedEmails({
          to: r.contact_email, name: r.contact_name || r.contact_email || "there", signer: q.accepted_name ?? "",
          bookingNumber: r.booking_number ?? r.id.slice(0, 8), reservationId: r.id, eventName: r.event_name ?? "your event",
          version: q.version, total: Number(q.total), signedAt: q.accepted_at!, includesAgreement: !!q.agreement_text,
          nextStep: next, pdf: pdf.bytes, filename: pdf.filename,
        });
      } catch (e) { console.error("[quote] after-approval failed:", (e as Error).message); }
    });
    return NextResponse.json({ ok: true, acceptedAt: q.accepted_at });
  } catch (e) {
    const status = e instanceof QuoteError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
