// ─── Quotes for approval (v1.59) ─────────────────────────────────────────────
// Staff send an itemized quote (a frozen copy of the booking's charges). The
// organizer opens a private link, reviews every line, and approves it by typing
// their name — the same signature also signs the Facility Use Agreement when
// the booking needs one. If charges change afterwards, the quote is out of
// date and staff send a new version. `db` is always the service client.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBilling, money, type Billing, type Charge } from "@/lib/billing";
import { readWaived } from "@/lib/waivers";
import { readVenue } from "@/lib/venue";
import { includedDates, isClosedStatus, venueToday } from "@/lib/dates";
import { generateToken } from "@/lib/agreement-token";
import { buildAgreementText } from "@/lib/agreements";
import { ESTIMATE_STATUSES } from "@/lib/room-prices";
import { renderInvoice } from "@/lib/invoice-pdf";
import { ROOMS } from "@/lib/rooms";
import { SITE_URL } from "@/lib/site";

export const INCLUDES_NOTE = "Prices include table/chair set-up and tear-down and trash removal at the close of the event.";
const VALID_DAYS = 30;

export interface QuoteLine { kind: Charge["kind"]; label: string; note: string | null; unit_price: number; quantity: number; amount: number }
export interface QuoteRow {
  id: string; reservation_id: string; version: number; token: string;
  lines: QuoteLine[]; subtotal: number; discounts: number; total: number; fingerprint: string;
  agreement_text: string | null; valid_until: string | null;
  sent_at: string; sent_by: string | null; sent_to: string | null; note: string | null;
  accepted_at: string | null; accepted_name: string | null; accepted_ip: string | null; accepted_ua: string | null;
  superseded_at: string | null;
  /** the booking's days when the quote was sent */
  schedule?: unknown[] | null;
}

/** Same charges → same fingerprint; any price, line or quantity change → different. */
export function fingerprint(charges: { label: string; unit_price: unknown; quantity: unknown }[]): string {
  const rows = charges.map((c) => [c.label, money(c.unit_price), money(c.quantity)]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 32);
}

const quoteUrl = (token: string) => `${SITE_URL}/quote/${token}`;
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** The newest quote that hasn't been replaced (null if none). */
export async function currentQuote(db: SupabaseClient, reservationId: string): Promise<QuoteRow | null> {
  const { data } = await db.from("bx_quotes").select("*").eq("reservation_id", reservationId)
    .is("superseded_at", null).order("version", { ascending: false }).limit(1).maybeSingle();
  return (data as QuoteRow | null) ?? null;
}

export interface QuoteState {
  version: number; token: string; total: number; sentAt: string; validUntil: string | null;
  acceptedAt: string | null; acceptedName: string | null;
  /** charges changed since it was sent */
  stale: boolean;
  /** the booking was cancelled, declined or finished */
  closed?: boolean;
  expired: boolean;
  includesAgreement: boolean;
}

export function quoteState(q: QuoteRow, charges: { label: string; unit_price: unknown; quantity: unknown }[]): QuoteState {
  return {
    version: q.version, token: q.token, total: money(q.total), sentAt: q.sent_at, validUntil: q.valid_until,
    acceptedAt: q.accepted_at, acceptedName: q.accepted_name,
    stale: fingerprint(charges) !== q.fingerprint,
    expired: !q.accepted_at && !!q.valid_until && q.valid_until < venueToday(),
    includesAgreement: !!q.agreement_text,
  };
}

type Res = {
  id: string; booking_number: string | null; event_name: string | null; status: string; user_id: string | null;
  contact_name: string | null; contact_email: string | null; contact_org: string | null; contact_phone: string | null;
  payload: unknown; waived: unknown; coi_accepted_at: string | null;
};
const RES_COLS = "id, booking_number, event_name, status, user_id, contact_name, contact_email, contact_org, contact_phone, payload, waived, coi_accepted_at";

function summaryOf(r: Res): string {
  const dates = includedDates(r.payload);
  const days = ((r.payload as { days?: { rooms?: { roomId: string }[]; included?: boolean }[] } | null)?.days ?? []).filter((d) => d.included !== false);
  const rooms = [...new Set(days.flatMap((d) => (d.rooms ?? []).map((x) => ROOMS.find((rm) => rm.id === x.roomId)?.name ?? x.roomId)))];
  return [r.event_name, dates.length ? dates.join(", ") : null, rooms.length ? rooms.join(", ") : null].filter(Boolean).join(" — ");
}

/** Does the booking still need the Facility Use Agreement signed? Returns its text if so. */
async function agreementToSign(db: SupabaseClient, r: Res): Promise<string | null> {
  if (readWaived(r.waived).agreement) return null;
  const { data: rows } = await db.from("reservation_agreements").select("agreement_text, customer_signed_at")
    .eq("reservation_id", r.id).order("created_at", { ascending: false });
  if ((rows ?? []).some((a) => a.customer_signed_at)) return null;
  const unsigned = (rows ?? [])[0]?.agreement_text as string | undefined;
  return unsigned || buildAgreementText(summaryOf(r), r.contact_name || r.contact_email || "Renter");
}

/**
 * Freeze the booking's charges into a new quote version, replace any earlier
 * one, email the organizer the approval link, and mark the booking "Proposal
 * Sent". Throws a plain-English error when a quote can't be sent.
 */
export async function sendQuote(
  db: SupabaseClient, reservationId: string, actor: { id: string; name: string }, opts: { note?: string; email?: boolean; notify?: boolean } = {},
): Promise<{ quote: QuoteRow; emailed: boolean }> {
  const { data: r } = await db.from("reservations").select(RES_COLS).eq("id", reservationId).maybeSingle<Res>();
  if (!r) throw new Error("Booking not found.");
  if (isClosedStatus(r.status) || ["declined", "expired"].includes(r.status)) throw new Error("This booking is closed, so there's no quote to send.");
  if (readWaived(r.waived).payment) throw new Error("Payment isn't needed for this booking, so there's no quote to send.");
  if (!r.contact_email) throw new Error("This booking has no contact email to send the quote to.");
  const billing = await getBilling(db, r.id);
  if (!billing.charges.length || billing.totals.charges <= 0) throw new Error("Add the charges first — the quote total is $0.");
  const cur = await currentQuote(db, r.id);
  if (cur?.accepted_at && fingerprint(billing.charges) === cur.fingerprint) {
    throw new Error(`Quote v${cur.version} is already approved for these charges.`);
  }

  const lines: QuoteLine[] = billing.charges.map((c) => ({
    kind: c.kind, label: c.label, note: c.note, unit_price: money(c.unit_price), quantity: money(c.quantity), amount: money(c.amount),
  }));
  const subtotal = money(lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0));
  const discounts = money(lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0));
  const first = includedDates(r.payload)[0];
  const today = venueToday();
  let validUntil = addDays(today, VALID_DAYS);
  if (first && first >= today && first < validUntil) validUntil = first;

  const now = new Date().toISOString();
  const schedule = ((r.payload as { days?: unknown[] } | null)?.days ?? []);
  const base = {
    reservation_id: r.id, token: generateToken(), lines, subtotal, discounts, total: billing.totals.charges,
    fingerprint: fingerprint(billing.charges), agreement_text: await agreementToSign(db, r), valid_until: validUntil,
    schedule, sent_at: now, sent_by: actor.id || null, sent_to: r.contact_email, note: (opts.note ?? "").trim().slice(0, 1000) || null,
  };
  // Insert the new version first, then retire the older ones (two sends at once
  // can't leave the booking without a current quote). Retry once on a version clash.
  let q: QuoteRow | null = null;
  for (let attempt = 0; attempt < 2 && !q; attempt++) {
    const { data: prev } = await db.from("bx_quotes").select("version").eq("reservation_id", r.id).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = ((prev?.version as number | undefined) ?? 0) + 1;
    const { data, error } = await db.from("bx_quotes").insert({ ...base, version }).select("*").single();
    if (data) q = data as QuoteRow;
    else if (error?.code !== "23505") throw new Error(error?.message ?? "Couldn't save the quote.");
  }
  if (!q) throw new Error("Another quote was being sent at the same moment — refresh and try again.");
  const version = q.version;
  const row = q;
  await db.from("bx_quotes").update({ superseded_at: now }).eq("reservation_id", r.id).is("superseded_at", null).neq("id", q.id);

  // Proposal Sent — the quote is the proposal
  const moved = ["pending", "pending_insurance", "needs_info"].includes(r.status);
  if (moved) await db.from("reservations").update({ status: "under_review", updated_at: now }).eq("id", r.id);
  if (r.user_id && opts.notify !== false) {
    await db.from("bx_notifications").insert({
      user_id: r.user_id, reservation_id: r.id, type: "quote_sent",
      title: "Your quote is ready", body: `Review and approve the quote for ${r.event_name ?? "your event"} (${r.booking_number ?? ""}).`,
    });
  }
  let emailed = false;
  if (opts.email !== false) {
    try {
      const { sendQuoteEmail } = await import("@/lib/email");
      emailed = await sendQuoteEmail({
        to: r.contact_email, name: r.contact_name || r.contact_email, bookingNumber: r.booking_number ?? r.id.slice(0, 8),
        eventName: r.event_name ?? "your event", version, lines, subtotal, discounts, total: money(billing.totals.charges),
        validUntil, url: quoteUrl(q.token), includesAgreement: !!row.agreement_text, note: row.note,
      });
    } catch (e) {
      // The quote is saved; the organizer can still open it from their booking page
      console.error("[quote] email failed:", (e as Error).message);
    }
  }
  await db.from("reservation_history").insert({
    reservation_id: r.id, actor_id: actor.id || null, actor_name: actor.name, actor_role: "admin", action: "quote_sent",
    from_status: r.status, to_status: moved ? "under_review" : r.status,
    note: `Quote v${version} sent for approval to ${r.contact_email} — ${usd(billing.totals.charges)}${row.agreement_text ? " (with the Facility Use Agreement)" : ""}${opts.email === false ? "" : emailed ? "." : ". The email didn't send — the organizer can approve it from their booking page."}`,
  });
  return { quote: q, emailed };
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Everything the public quote page needs, by token. */
export async function loadQuote(db: SupabaseClient, token: string) {
  if (!/^[0-9a-f]{32,64}$/i.test(token)) return null;
  const { data: q } = await db.from("bx_quotes").select("*").eq("token", token).maybeSingle<QuoteRow>();
  if (!q) return null;
  const { data: r } = await db.from("reservations").select(RES_COLS).eq("id", q.reservation_id).maybeSingle<Res>();
  if (!r) return null;
  const billing = await getBilling(db, r.id);
  const closed = isClosedStatus(r.status) || ["declined", "expired"].includes(r.status);
  return { quote: q, reservation: r, state: { ...quoteState(q, billing.charges), closed } };
}

/** Build the quote PDF from its frozen lines (approved or not). */
export async function quotePdf(db: SupabaseClient, q: QuoteRow, r: Res): Promise<{ bytes: Uint8Array; filename: string }> {
  const venue = await readVenue(db);
  const charges = q.lines.map((l, i) => ({
    id: String(i), kind: l.kind, addon_id: null, label: l.label, unit_price: l.unit_price, quantity: l.quantity, amount: l.amount,
    note: l.note, added_by: null, added_by_staff: true, created_at: q.sent_at,
  })) as Charge[];
  const billing: Billing = { charges, payments: [], totals: { charges: money(q.total), paid: 0, balance: money(q.total) }, lastReminderAt: null };
  type D = { date: string; included?: boolean; customStart?: string; customEnd?: string; rooms?: { roomId: string }[] };
  const days = ((q.schedule as D[] | null) ?? ((r.payload as { days?: D[] } | null)?.days) ?? [])
    .filter((d) => d.included !== false && d.date)
    .map((d) => ({ date: d.date, start: d.customStart, end: d.customEnd, rooms: (d.rooms ?? []).map((x) => x.roomId) }));
  const bytes = await renderInvoice({
    bookingNumber: r.booking_number ?? r.id.slice(0, 8),
    eventName: r.event_name || "Your event",
    status: null,
    contact: { name: r.contact_name || r.contact_email || "", org: r.contact_org, email: r.contact_email, phone: r.contact_phone },
    days, billing,
    venue: { name: venue.venue_name, address: venue.venue_address },
    issuedYmd: q.sent_at.slice(0, 10),
    paymentNote: venue.venue_payment,
    includesNote: INCLUDES_NOTE,
    quote: {
      version: q.version, validUntil: q.valid_until, approveUrl: quoteUrl(q.token),
      accepted: q.accepted_at ? { name: q.accepted_name ?? "", at: q.accepted_at, ip: q.accepted_ip } : null,
      agreementText: q.agreement_text,
    },
  });
  return { bytes, filename: `Quote-${r.booking_number ?? r.id.slice(0, 8)}-v${q.version}${q.accepted_at ? "-approved" : ""}.pdf` };
}

/**
 * The organizer approves the quote (and signs the agreement if it's included).
 * Throws a plain-English error the page can show.
 */
export async function acceptQuote(
  db: SupabaseClient, token: string, signer: { name: string; ip: string; ua: string },
): Promise<QuoteRow> {
  const loaded = await loadQuote(db, token);
  if (!loaded) throw new QuoteError("This quote link isn't valid.", 404);
  const { quote: q, reservation: r, state } = loaded;
  if (q.accepted_at) throw new QuoteError("This quote was already approved.", 409);
  if (state.closed) throw new QuoteError("This booking was cancelled or closed, so the quote can't be approved.", 410);
  if (q.superseded_at) throw new QuoteError("A newer quote replaced this one — check your email or your booking page for the latest.", 410);
  if (state.expired) throw new QuoteError("This quote has expired. Ask the BX team to send a fresh one.", 410);
  if (state.stale) throw new QuoteError("The charges on this booking changed after this quote was sent. The BX team will send an updated quote.", 409);
  const name = signer.name.trim().replace(/\s+/g, " ").slice(0, 120);
  if (name.length < 2) throw new QuoteError("Type your full name to approve.", 400);

  const at = new Date().toISOString();
  const { data: done, error } = await db.from("bx_quotes")
    .update({ accepted_at: at, accepted_name: name, accepted_ip: signer.ip, accepted_ua: signer.ua.slice(0, 400) })
    .eq("id", q.id).is("accepted_at", null).is("superseded_at", null).select("*").maybeSingle<QuoteRow>();
  if (error) throw new QuoteError(error.message, 500);
  if (!done) throw new QuoteError("This quote was already approved or replaced.", 409);

  // The same signature signs the Facility Use Agreement
  if (q.agreement_text) {
    const { data: existing } = await db.from("reservation_agreements").select("id, customer_signed_at")
      .eq("reservation_id", r.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const sig = { customer_name: name, customer_signed_at: at, customer_ip: signer.ip, customer_user_agent: signer.ua.slice(0, 400), agreement_text: q.agreement_text };
    if (existing && !existing.customer_signed_at) await db.from("reservation_agreements").update(sig).eq("id", existing.id);
    else if (!existing) await db.from("reservation_agreements").insert({ reservation_id: r.id, token: generateToken(), ...sig, sent_at: q.sent_at });
  }

  // Next step: insurance if it's still needed, otherwise payment
  const w = readWaived(r.waived);
  let next = r.status;
  if (ESTIMATE_STATUSES.has(r.status)) next = !w.coi && !r.coi_accepted_at ? "pending_documents" : "pending_payment";
  if (next !== r.status) await db.from("reservations").update({ status: next, updated_at: at }).eq("id", r.id);
  await db.from("reservation_history").insert({
    reservation_id: r.id, actor_id: r.user_id, actor_name: name, actor_role: "user", action: "quote_approved",
    from_status: r.status, to_status: next,
    note: `Quote v${q.version} approved (${usd(money(q.total))})${q.agreement_text ? " and the Facility Use Agreement signed" : ""} by ${name}.`,
    metadata: { ip: signer.ip, signed_at: at },
  });
  return done;
}

export class QuoteError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/**
 * Staff looking at a quote they sent see a preview, not the approval form —
 * only the organizer or a co-organizer may approve. (Someone who isn't signed
 * in is treated as the organizer: the private emailed link is their key.)
 */
export async function isStaffPreview(db: SupabaseClient, r: { id: string; user_id: string | null; contact_email: string | null }): Promise<boolean> {
  const { getUserAndRole } = await import("@/lib/get-user-role");
  const { can } = await import("@/lib/roles");
  const { user, role } = await getUserAndRole();
  if (!user || !can.approveReservations(role)) return false;
  const email = (user.email ?? "").toLowerCase();
  if (r.user_id === user.id || (!!email && (r.contact_email ?? "").toLowerCase() === email)) return false;
  const { data: collab } = await db.from("reservation_collaborators").select("collab_role")
    .eq("reservation_id", r.id).eq("user_id", user.id).not("accepted_at", "is", null).maybeSingle();
  return collab?.collab_role !== "co_owner";
}
