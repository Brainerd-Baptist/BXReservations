import { INCLUDES_NOTE, type QuoteRow, type QuoteState } from "@/lib/quotes";
import { ROOMS } from "@/lib/rooms";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/site";
import QuoteApproveForm from "./quote-approve-form";

const usd = (n: number) => (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
const longDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const time12 = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
};
const SLOT: Record<string, string> = { morning: "Morning (8am–12pm)", afternoon: "Afternoon (12–5pm)", evening: "Evening (5–10pm)", any: "All day (8am–10pm)" };

type Res = { id: string; booking_number: string | null; event_name: string | null; contact_name: string | null; contact_org: string | null; payload: unknown };

/** The itemized quote, the agreement (if included) and the approval form. */
export default function QuoteView({ quote: q, reservation: r, state, staffPreview = false }: {
  quote: QuoteRow; reservation: Res; state: QuoteState & { closed?: boolean };
  /** BX staff viewing a quote they sent: no approval form */
  staffPreview?: boolean;
}) {
  type Day = { date: string; included?: boolean; timeSlot?: string; customStart?: string; customEnd?: string; rooms?: { roomId: string }[] };
  // The schedule as quoted (older quotes fall back to the booking's current one)
  const days = ((q.schedule as Day[] | null) ?? ((r.payload as { days?: Day[] } | null)?.days) ?? []).filter((d) => d.included !== false && d.date);
  const signedAt = q.accepted_at
    ? new Date(q.accepted_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " ET"
    : null;
  const blocked = !q.accepted_at && (state.closed ? "closed" : q.superseded_at ? "replaced" : state.expired ? "expired" : state.stale ? "changed" : null);

  return (
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate">BX · Brainerd Baptist Church</p>
          <h1 className="text-3xl font-bold text-parchment mt-1">{q.version > 1 ? "Your updated quote" : "Your quote"}</h1>
          <p className="text-slate mt-1">{r.event_name || "Your event"} · {r.booking_number ?? ""} · Version {q.version}</p>
        </header>

        {staffPreview && (
          <div className="bx-tone-indigo border rounded-xl px-4 py-3 text-sm" role="note">
            <p className="font-semibold">Staff preview</p>
            <p className="text-xs mt-0.5">This is exactly what the organizer sees. Only they (or a co-organizer) can approve it — staff can&apos;t sign on their behalf.</p>
          </div>
        )}

        {q.superseded_at && (
          <div className="bx-tone-amber border rounded-xl px-4 py-3 text-sm" role="status">
            A newer quote replaced this one. Check your email for the latest, or open your booking page.
          </div>
        )}

        {/* Event */}
        <section className="bx-glass rounded-2xl p-5" aria-labelledby="q-event">
          <h2 id="q-event" className="text-xs font-semibold uppercase tracking-widest text-slate mb-2">Your event</h2>
          <p className="font-semibold text-parchment">{r.contact_name}{r.contact_org ? ` · ${r.contact_org}` : ""}</p>
          <ul className="mt-2 space-y-1 text-sm text-parchment">
            {days.map((d) => (
              <li key={d.date}>
                <strong>{longDate(d.date)}</strong>
                <span className="text-slate"> · {d.customStart && d.customEnd ? `${time12(d.customStart)}–${time12(d.customEnd)}` : SLOT[d.timeSlot ?? "any"] ?? "All day"}</span>
                <span className="text-slate"> · {(d.rooms ?? []).map((x) => ROOMS.find((rm) => rm.id === x.roomId)?.name ?? x.roomId).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Itemized quote */}
        <section className="bx-glass rounded-2xl overflow-hidden" aria-labelledby="q-items">
          <h2 id="q-items" className="text-xs font-semibold uppercase tracking-widest text-slate px-5 pt-5 pb-2">Itemized quote</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Quote line items</caption>
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i} className="border-t border-parchment/10">
                  <td className="px-5 py-3">
                    <div className="font-medium text-parchment">{l.label}</div>
                    {(l.quantity !== 1 || l.note) && (
                      <div className="text-xs text-slate">
                        {l.quantity !== 1 && <>{l.quantity} × {usd(l.unit_price)}</>}
                        {l.quantity !== 1 && l.note && " · "}
                        {l.note}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular font-semibold whitespace-nowrap text-parchment" style={l.amount < 0 ? { color: "var(--tone-green-fg)" } : undefined}>{usd(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="border-t border-parchment/15 px-5 py-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate"><dt>Subtotal</dt><dd className="tabular">{usd(Number(q.subtotal))}</dd></div>
            {Number(q.discounts) !== 0 && <div className="flex justify-between text-slate"><dt>Discounts</dt><dd className="tabular">{usd(Number(q.discounts))}</dd></div>}
            <div className="flex justify-between text-lg font-bold text-parchment pt-1"><dt>Quote total</dt><dd className="tabular">{usd(Number(q.total))}</dd></div>
          </dl>
          <p className="px-5 pb-4 text-xs text-slate">
            {INCLUDES_NOTE}
            {q.valid_until && !q.accepted_at && <> This quote is good until {longDate(q.valid_until)}.</>}
          </p>
        </section>

        {q.note && (
          <section className="bx-well rounded-xl px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate mb-1">Note from the BX team</p>
            <p className="text-parchment whitespace-pre-line">{q.note}</p>
          </section>
        )}

        {/* Facility Use Agreement, signed with the quote */}
        {q.agreement_text && (
          <section className="bx-glass rounded-2xl p-5" aria-labelledby="q-agree">
            <h2 id="q-agree" className="text-xs font-semibold uppercase tracking-widest text-slate mb-2">Facility Use Agreement</h2>
            <div className="bx-well rounded-xl p-4 max-h-80 overflow-y-auto" tabIndex={0} aria-label="Agreement text">
              <div className="whitespace-pre-wrap text-[0.85rem] leading-6 text-parchment" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>{q.agreement_text}</div>
            </div>
          </section>
        )}

        {/* Approve */}
        {q.accepted_at ? (
          <section className="bx-tone-green border rounded-2xl p-5" role="status">
            <p className="font-semibold text-lg">✓ Approved</p>
            <p className="text-sm mt-1">
              Approved by <strong>{q.accepted_name}</strong> on {signedAt}{q.agreement_text ? ", including the Facility Use Agreement" : ""}.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a className="bx-btn bx-btn--primary bx-btn--sm" href={`/api/quote/${q.token}/pdf`} target="_blank" rel="noopener">Signed copy (PDF)</a>
              <a className="bx-btn bx-btn--secondary bx-btn--sm" href={`/reservations/${r.id}`}>Go to your booking</a>
            </div>
          </section>
        ) : blocked ? (
          <section className="bx-tone-amber border rounded-2xl p-5" role="status">
            <p className="font-semibold">This quote can&apos;t be approved</p>
            <p className="text-sm mt-1">
              {blocked === "closed" ? "This booking was cancelled or closed."
                : blocked === "replaced" ? "A newer quote replaced it."
                : blocked === "expired" ? "It has expired."
                : "The charges on your booking changed after it was sent."}
              {" "}{blocked === "closed" ? "Questions? Email" : "The BX team will send an updated quote — or email"} <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </section>
        ) : staffPreview ? (
          <section className="bx-well rounded-2xl p-5 text-sm text-slate" role="status">
            Waiting for {r.contact_name || "the organizer"} to approve{q.agreement_text ? " and sign" : ""}. You&apos;ll get an email and a notification when they do.
          </section>
        ) : (
          <QuoteApproveForm token={q.token} contactName={r.contact_name ?? ""} total={usd(Number(q.total))} includesAgreement={!!q.agreement_text} />
        )}

        <p className="text-center text-xs text-slate">
          <a className="underline" href={`/api/quote/${q.token}/pdf`} target="_blank" rel="noopener">Download this quote (PDF)</a>
          {" · "}Questions? <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · {SUPPORT_PHONE}
        </p>
      </div>
    </div>
  );
}
