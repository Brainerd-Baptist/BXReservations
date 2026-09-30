"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { useToast } from "./Toast";
import LoadError from "./load-error";
import { CHARGE_KIND_LABEL, UNIT_LABEL, usd, type Addon, type Billing, type ChargeKind } from "@/lib/billing";

type BillingResponse = Billing & { staff: boolean; canAddAddons: boolean; userId: string; howToPay?: string | null; paymentWaived?: boolean };

const METHODS = ["Check", "Cash", "Card", "ACH / transfer", "Other"];
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) =>
  new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data;
}

/**
 * What's owed and paid on one booking: line items (room rental, add-ons,
 * fees, discounts), payments, and the balance. Requesters can add catalog
 * add-ons while the booking is open; staff can do everything.
 */
export default function BillingCard({ reservationId, compact = false }: { reservationId: string; compact?: boolean }) {
  const { toast } = useToast();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "addon" | "line" | "payment">(null);
  const [catalog, setCatalog] = useState<Addon[] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await jsonOrThrow(await fetch(`/api/reservations/${reservationId}/billing`)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [reservationId]);

  useEffect(() => {
    let live = true;
    fetch(`/api/reservations/${reservationId}/billing`)
      .then(jsonOrThrow)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [reservationId]);

  async function openAddon() {
    setPanel("addon");
    if (!catalog) {
      try { setCatalog(await jsonOrThrow(await fetch("/api/addons"))); }
      catch { setCatalog([]); }
    }
  }

  async function act(key: string, fn: () => Promise<void>, ok?: string) {
    setBusy(key);
    try { await fn(); if (ok) toast(ok, "success"); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(null); }
  }

  const post = (body: unknown) =>
    act("add", async () => {
      await jsonOrThrow(await fetch(`/api/reservations/${reservationId}/billing`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      setPanel(null);
      await load();
    }, "Added.");

  const removeCharge = (id: string) =>
    act(`c-${id}`, async () => {
      await jsonOrThrow(await fetch(`/api/reservations/${reservationId}/billing?chargeId=${id}`, { method: "DELETE" }));
      await load();
    }, "Removed.");

  const removePayment = (id: string) => {
    if (!confirm("Remove this payment? Use this only for a payment recorded by mistake.")) return;
    return act(`p-${id}`, async () => {
      await jsonOrThrow(await fetch(`/api/admin/reservations/${reservationId}/payment?paymentId=${id}`, { method: "DELETE" }));
      await load();
    }, "Payment removed.");
  };

  const remind = () =>
    act("remind", async () => {
      await jsonOrThrow(await fetch(`/api/admin/reservations/${reservationId}/remind`, { method: "POST" }));
      await load();
    }, "Reminder sent.");

  if (error) return <LoadError what="charges and payments" message={error} onRetry={load} />;
  if (!data) return <div className="bx-well rounded-xl p-4 text-sm text-slate" aria-busy="true">Loading charges and payments…</div>;

  const { charges, payments, totals, staff } = data;
  const balanceTone = totals.balance > 0 ? "bx-tone-amber" : totals.balance < 0 ? "bx-tone-indigo" : "bx-tone-green";

  return (
    <div className="space-y-4">
      {/* Line items */}
      <div className="bx-well rounded-xl overflow-hidden">
        {charges.length === 0 ? (
          <p className="p-4 text-sm text-slate">
            {staff ? "No charges yet. Add the room rental and any add-ons." : "No charges yet. The BX team will add your total after reviewing your request."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Charges</caption>
            <tbody>
              {charges.map((c) => {
                const mine = c.kind === "addon" && !c.added_by_staff && c.added_by === data.userId;
                const canRemove = staff || (mine && data.canAddAddons);
                return (
                  <tr key={c.id} className="border-b border-parchment/8 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-parchment">{c.label}</div>
                      <div className="text-xs text-slate">
                        {CHARGE_KIND_LABEL[c.kind as ChargeKind]}
                        {c.quantity !== 1 && <> · {c.quantity} × {usd(c.unit_price)}</>}
                        {c.note && <> · {c.note}</>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular font-semibold text-parchment whitespace-nowrap">{usd(c.amount)}</td>
                    {canRemove && (
                      <td className="pr-2 w-10">
                        <button type="button" onClick={() => removeCharge(c.id)} disabled={busy === `c-${c.id}`}
                          className="bx-btn bx-btn--ghost bx-btn--sm" aria-label={`Remove ${c.label}`}>×</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="bx-well rounded-xl px-2 py-3">
          <dt className="text-[11px] uppercase tracking-wide text-slate">Total</dt>
          <dd className="text-base font-bold text-parchment tabular">{usd(totals.charges)}</dd>
        </div>
        <div className="bx-well rounded-xl px-2 py-3">
          <dt className="text-[11px] uppercase tracking-wide text-slate">Paid</dt>
          <dd className="text-base font-bold text-parchment tabular">{usd(totals.paid)}</dd>
        </div>
        <div className={`${balanceTone} border rounded-xl px-2 py-3`}>
          <dt className="text-[11px] uppercase tracking-wide">{totals.balance < 0 ? "Credit" : "Balance due"}</dt>
          <dd className="text-base font-bold tabular">{usd(Math.abs(totals.balance))}</dd>
        </div>
      </dl>

      {/* How to pay (C3) — only when something is owed */}
      {!data.staff && totals.balance > 0 && data.howToPay && (
        <div className="bx-well rounded-xl px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate mb-1">How to pay</p>
          <p className="text-sm text-parchment whitespace-pre-line">{data.howToPay}</p>
          <p className="text-xs text-slate mt-1.5">You&apos;ll get a receipt by email when your payment is recorded.</p>
        </div>
      )}
      {data.paymentWaived && totals.charges <= 0 && (
        <p className="text-xs text-slate">No payment is needed for this booking.</p>
      )}

      {/* Payments */}
      {payments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate mb-1.5">Payments</p>
          <ul className="space-y-1">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-parchment">
                  {usd(p.amount)} <span className="text-slate">· {p.method} · {fmtDate(p.received_at)}</span>
                  {p.receipt_url && <> · <a href={p.receipt_url} target="_blank" rel="noopener" className="underline">receipt</a></>}
                  {p.note && <span className="text-slate"> · {p.note}</span>}
                </span>
                {staff && (
                  <button type="button" onClick={() => removePayment(p.id)} disabled={busy === `p-${p.id}`}
                    className="bx-btn bx-btn--ghost bx-btn--sm" aria-label={`Remove payment of ${usd(p.amount)}`}>×</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {data.canAddAddons && <Button size="sm" variant="secondary" onClick={openAddon}>+ Add-on</Button>}
        {staff && <Button size="sm" variant="secondary" onClick={() => setPanel("line")}>+ Charge or discount</Button>}
        {staff && <Button size="sm" onClick={() => setPanel("payment")}>Record payment</Button>}
        {staff && (
          <Button size="sm" variant="secondary" onClick={remind} loading={busy === "remind"} disabled={totals.balance <= 0}>
            Send reminder
          </Button>
        )}
        {charges.length > 0 && (
          <a className="bx-btn bx-btn--secondary bx-btn--sm" href={`/api/reservations/${reservationId}/invoice`} target="_blank" rel="noopener">
            {totals.balance <= 0 ? "Receipt (PDF)" : "Invoice (PDF)"}
          </a>
        )}
        {staff && charges.length > 0 && (
          <Button size="sm" variant="secondary" loading={busy === "invoice"}
            onClick={() => act("invoice", async () => {
              const d = await jsonOrThrow(await fetch(`/api/admin/reservations/${reservationId}/send-invoice`, { method: "POST" }));
              toast(d.kind === "receipt" ? "Receipt emailed." : "Invoice emailed.", "success");
            })}>
            Email {totals.balance <= 0 ? "receipt" : "invoice"}
          </Button>
        )}
      </div>
      {staff && data.lastReminderAt && !compact && (
        <p className="text-xs text-slate">Last reminder sent {fmtDate(data.lastReminderAt)}.</p>
      )}

      {panel === "addon" && (
        <AddonForm catalog={catalog} busy={busy === "add"} onCancel={() => setPanel(null)}
          onAdd={(addon_id, quantity) => post({ addon_id, quantity })} />
      )}
      {panel === "line" && (
        <LineForm busy={busy === "add"} onCancel={() => setPanel(null)} onAdd={(b) => post(b)} />
      )}
      {panel === "payment" && (
        <PaymentForm balance={totals.balance} busy={busy === "pay"} onCancel={() => setPanel(null)}
          onSave={(b) => act("pay", async () => {
            await jsonOrThrow(await fetch(`/api/admin/reservations/${reservationId}/payment`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
            }));
            setPanel(null);
            await load();
          }, "Payment recorded.")} />
      )}
    </div>
  );
}

function AddonForm({ catalog, busy, onAdd, onCancel }: {
  catalog: Addon[] | null; busy: boolean; onAdd: (id: string, qty: number) => void; onCancel: () => void;
}) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState("1");
  if (!catalog) return <p className="text-sm text-slate">Loading add-ons…</p>;
  if (!catalog.length) return <p className="text-sm text-slate">No add-ons are available yet.</p>;
  const pick = catalog.find((a) => a.id === id);
  return (
    <form className="bx-well rounded-xl p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (id) onAdd(id, Number(qty) || 1); }}>
      <Field label="Add-on">
        <Select value={id} onChange={(e) => setId(e.target.value)} required>
          <option value="">Choose…</option>
          {catalog.map((a) => <option key={a.id} value={a.id}>{a.name} — {usd(Number(a.price))} {UNIT_LABEL[a.unit]}</option>)}
        </Select>
      </Field>
      {pick?.description && <p className="text-xs text-slate">{pick.description}</p>}
      {pick && pick.unit !== "flat" && (
        <Field label={pick.unit === "per_day" ? "Days" : "Quantity"}>
          <Input type="number" min="1" step="1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={!id}>Add</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function LineForm({ busy, onAdd, onCancel }: {
  busy: boolean; onAdd: (b: { kind: ChargeKind; label: string; unit_price: number; quantity: number; note: string }) => void; onCancel: () => void;
}) {
  const [kind, setKind] = useState<ChargeKind>("rental");
  const [label, setLabel] = useState("Room rental");
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const defaults: Record<string, string> = { rental: "Room rental", fee: "", discount: "Discount" };
  return (
    <form className="bx-well rounded-xl p-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); onAdd({ kind, label, unit_price: Number(amount), quantity: Number(qty) || 1, note }); }}>
      <Field label="Type">
        <Select value={kind} onChange={(e) => { const k = e.target.value as ChargeKind; setKind(k); if (!label || Object.values(defaults).includes(label)) setLabel(defaults[k] ?? ""); }}>
          <option value="rental">Room rental</option>
          <option value="fee">Other charge</option>
          <option value="discount">Discount</option>
        </Select>
      </Field>
      <Field label="Description">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={120} placeholder="e.g. Gym, Saturday 9–5" />
      </Field>
      <Field label={kind === "discount" ? "Amount off ($)" : "Amount ($)"}>
        <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Field label="Quantity" hint="Hours, days or items — the amount is per one">
        <Input type="number" min="0.25" step="0.25" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
      </Field>
      <Field label="Note (optional)" className="sm:col-span-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" loading={busy}>Add line</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function PaymentForm({ balance, busy, onSave, onCancel }: {
  balance: number; busy: boolean; onSave: (b: Record<string, unknown>) => void; onCancel: () => void;
}) {
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : "");
  const [method, setMethod] = useState("Check");
  const [date, setDate] = useState(today());
  const [receipt, setReceipt] = useState("");
  const [note, setNote] = useState("");
  const [sendReceipt, setSendReceipt] = useState(true);
  return (
    <form className="bx-well rounded-xl p-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); onSave({ amount: Number(amount), method, received_at: date, receipt_url: receipt, note, send_receipt: sendReceipt }); }}>
      <Field label="Amount ($)" hint={balance > 0 ? `Balance due is ${usd(balance)}` : undefined}>
        <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Field label="Method">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </Field>
      <Field label="Date received">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="Receipt link (optional)">
        <Input type="url" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Note (optional)" hint="e.g. Check #1042, deposit" className="sm:col-span-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-parchment sm:col-span-2">
        <input type="checkbox" className="w-4 h-4" checked={sendReceipt} onChange={(e) => setSendReceipt(e.target.checked)} />
        Email the organizer a receipt (PDF attached)
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" loading={busy}>Save payment</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
