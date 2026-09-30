"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Shield, DollarSign } from "lucide-react";
import { ReservationListSkeleton } from "@/app/components/Skeleton";
import LoadError from "@/app/components/load-error";
import { fetchArray } from "@/lib/fetch-list";
import { daysFromToday, formatDateish, toVenueYmd } from "@/lib/dates";

// ─── Types ──────────────────────────────────────────────────────────────────────
interface AgreementRow {
  reservation_id: string;
  booking_number: string;
  contact_name: string;
  contact_org: string;
  event_name: string;
  event_date: string;
  customer_signed_at: string;
  pdf_url: string | null;
}

interface COIRow {
  reservation_id: string;
  booking_number: string;
  contact_name: string;
  contact_org: string;
  event_name: string;
  coi_uploaded_at: string;
  coi_accepted_at: string | null;
  coi_expiry_date: string | null;
  coi_file_url: string | null;
}

interface PaymentRow {
  reservation_id: string;
  booking_number: string;
  contact_name: string;
  contact_org: string;
  event_name: string;
  payment_received_at: string;
  payment_amount: number;
  payment_method: string;
  payment_receipt_url: string | null;
}

type Tab = "agreements" | "cois" | "payments";

// ─── COI expiry helpers ─────────────────────────────────────────────────────────
// Whole days left in venue time: a certificate that expires today is valid
// today (it used to read as expired from 8pm the day before — audit F09).
const coiDaysLeft = (expiry: string) => daysFromToday(toVenueYmd(expiry));
function coiExpiryColor(expiryDate: string | null): string {
  if (!expiryDate) return "text-slate bg-ink-soft border-parchment/10";
  const days = coiDaysLeft(expiryDate);
  if (days < 0)  return "text-red-700 bg-red-50 border-red-200";      // expired
  if (days < 14) return "text-red-700 bg-red-50 border-red-200";      // <14d urgent
  if (days < 45) return "text-amber-700 bg-amber-50 border-amber-200"; // 14-45d warning
  return "text-emerald-700 bg-emerald-50 border-emerald-200";           // >60d
}

function coiExpiryLabel(expiryDate: string | null): string {
  if (!expiryDate) return "No expiry recorded";
  const days = coiDaysLeft(expiryDate);
  const fmt = formatDateish(expiryDate) ?? expiryDate;
  if (days < 0)  return `Expired ${fmt}`;
  if (days === 0) return `Expires today`;
  return `${fmt} (${days}d)`;
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function DocumentsHub() {
  const [activeTab, setActiveTab] = useState<Tab>("agreements");

  // Agreements
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [agreementsLoaded, setAgreementsLoaded] = useState(false);

  // COIs
  const [cois, setCois] = useState<COIRow[]>([]);
  const [coisLoading, setCoisLoading] = useState(false);
  const [coisLoaded, setCoisLoaded] = useState(false);
  const [coiFilter, setCoiFilter] = useState<"all" | "pending" | "accepted" | "expired">("all");
  const [coiSearch, setCoiSearch] = useState("");

  // Payments
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);

  // A failed load is shown as an error with Retry — never as an empty list,
  // and never stored as if the error object were the list (audit F06).
  const [loadErr, setLoadErr] = useState<Record<Tab, string | null>>({ agreements: null, cois: null, payments: null } as Record<Tab, string | null>);
  const [reloadKey, setReloadKey] = useState(0);
  const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
  function retry(tab: Tab) {
    setLoadErr(prev => ({ ...prev, [tab]: null }));
    if (tab === "agreements") setAgreementsLoaded(false);
    if (tab === "cois") setCoisLoaded(false);
    if (tab === "payments") setPaymentsLoaded(false);
    setReloadKey(k => k + 1);
  }

  // ── Fetch on tab open (lazy) ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "agreements" && !agreementsLoaded && !agreementsLoading && !loadErr.agreements) {
      setAgreementsLoading(true);
      fetchArray<AgreementRow>("/api/admin/documents?type=agreements")
        .then(d => { setAgreements(d); setAgreementsLoaded(true); })
        .catch(e => setLoadErr(prev => ({ ...prev, agreements: errMsg(e) })))
        .finally(() => setAgreementsLoading(false));
    }
    if (activeTab === "cois" && !coisLoaded && !coisLoading && !loadErr.cois) {
      setCoisLoading(true);
      fetchArray<COIRow>("/api/admin/documents?type=cois")
        .then(d => { setCois(d); setCoisLoaded(true); })
        .catch(e => setLoadErr(prev => ({ ...prev, cois: errMsg(e) })))
        .finally(() => setCoisLoading(false));
    }
    if (activeTab === "payments" && !paymentsLoaded && !paymentsLoading && !loadErr.payments) {
      setPaymentsLoading(true);
      fetchArray<PaymentRow>("/api/admin/documents?type=payments")
        .then(d => { setPayments(d); setPaymentsLoaded(true); })
        .catch(e => setLoadErr(prev => ({ ...prev, payments: errMsg(e) })))
        .finally(() => setPaymentsLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reloadKey]);

  const filteredCois = cois.filter(c => {
    if (coiFilter === "pending"  && c.coi_accepted_at)   return false;
    if (coiFilter === "accepted" && !c.coi_accepted_at)  return false;
    if (coiFilter === "expired") {
      if (!c.coi_expiry_date) return false;
      const days = coiDaysLeft(c.coi_expiry_date);
      if (days >= 0) return false;
    }
    if (coiSearch.trim()) {
      const q = coiSearch.toLowerCase();
      if (
        !c.contact_name.toLowerCase().includes(q) &&
        !c.contact_org.toLowerCase().includes(q) &&
        !c.event_name.toLowerCase().includes(q) &&
        !c.booking_number.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalPayments = payments.reduce((s, p) => s + p.payment_amount, 0);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/bx-reservations" className="text-xs text-[var(--bx-brass)] hover:underline">
              ← Back to Reservations
            </Link>
            <h1 className="text-xl font-bold text-parchment mt-1">Documents Hub</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bx-well rounded-xl p-1 w-fit">
          {(["agreements", "cois", "payments"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t
                  ? "bg-[var(--bbc-navy)] text-white shadow"
                  : "text-slate hover:text-parchment"
              }`}
            >
              {t === "agreements" && <span className="flex items-center gap-1.5"><FileText size={14} />Agreements</span>}
              {t === "cois"       && <span className="flex items-center gap-1.5"><Shield size={14} />COIs</span>}
              {t === "payments"   && <span className="flex items-center gap-1.5"><DollarSign size={14} />Payments</span>}
            </button>
          ))}
        </div>

        {/* ── Agreements tab ─────────────────────────────────────────────────────── */}
        {activeTab === "agreements" && (
          <div className="bx-glass rounded-xl overflow-hidden">
            {agreementsLoading && <p className="p-8 text-center text-slate text-sm animate-pulse">Loading…</p>}
            {loadErr.agreements && <div className="p-4"><LoadError what="agreements" message={loadErr.agreements} onRetry={() => retry("agreements")} /></div>}
            {!agreementsLoading && agreements.length === 0 && agreementsLoaded && (
              <p className="p-8 text-center text-slate text-sm">No signed agreements yet.</p>
            )}
            {!agreementsLoading && agreements.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment/10 text-xs text-slate uppercase tracking-widest">
                    <th className="text-left px-4 py-3">Booking</th>
                    <th className="text-left px-4 py-3">Renter</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Event</th>
                    <th className="text-left px-4 py-3">Signed</th>
                    <th className="text-left px-4 py-3">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map(ag => (
                    <tr key={ag.reservation_id} className="border-b border-parchment/5 hover:bg-parchment/5">
                      <td className="px-4 py-3">
                        <Link href={`/admin/bx-reservations?booking=${ag.booking_number}`} className="text-[var(--bx-brass)] hover:underline font-mono text-xs">
                          {ag.booking_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-parchment font-medium">{ag.contact_name}</p>
                        {ag.contact_org && <p className="text-xs text-slate">{ag.contact_org}</p>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-parchment/80">{ag.event_name}</p>
                        {ag.event_date && <p className="text-xs text-slate">{ag.event_date}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate text-xs">
                        {new Date(ag.customer_signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        {ag.pdf_url
                          ? <a href={ag.pdf_url} target="_blank" rel="noreferrer" className="text-[var(--bx-brass)] hover:underline text-xs">Download</a>
                          : <span className="text-slate text-xs">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── COIs tab ────────────────────────────────────────────────────────────── */}
        {activeTab === "cois" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="search"
                placeholder="Search by name, org, event…"
                value={coiSearch}
                onChange={e => setCoiSearch(e.target.value)}
                className="rounded-lg border border-parchment/20 bg-ink-soft text-parchment text-sm px-3 py-2 placeholder-slate focus:outline-none focus:ring-1 focus:ring-[var(--bbc-blue)]"
              />
              <div className="flex gap-1">
                {(["all", "pending", "accepted", "expired"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setCoiFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      coiFilter === f
                        ? "bg-[var(--bbc-navy)] text-white"
                        : "bg-ink-soft text-slate border border-parchment/15 hover:border-parchment/30"
                    }`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bx-glass rounded-xl overflow-hidden">
              {coisLoading && <ReservationListSkeleton rows={5} />}
              {loadErr.cois && <div className="p-4"><LoadError what="insurance certificates" message={loadErr.cois} onRetry={() => retry("cois")} /></div>}
              {!coisLoading && filteredCois.length === 0 && coisLoaded && (
                <p className="p-8 text-center text-slate text-sm">No COIs match this filter.</p>
              )}
              {!coisLoading && filteredCois.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-parchment/10 text-xs text-slate uppercase tracking-widest">
                      <th className="text-left px-4 py-3">Booking</th>
                      <th className="text-left px-4 py-3">Renter / Org</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Uploaded</th>
                      <th className="text-left px-4 py-3">Expiry</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCois.map(c => (
                      <tr key={c.reservation_id} className="border-b border-parchment/5 hover:bg-parchment/5">
                        <td className="px-4 py-3">
                          <Link href={`/admin/bx-reservations?booking=${c.booking_number}`} className="text-[var(--bx-brass)] hover:underline font-mono text-xs">
                            {c.booking_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-parchment font-medium">{c.contact_name}</p>
                          {c.contact_org && <p className="text-xs text-slate">{c.contact_org}</p>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-slate text-xs">
                          {new Date(c.coi_uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${coiExpiryColor(c.coi_expiry_date)}`}>
                            {coiExpiryLabel(c.coi_expiry_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.coi_accepted_at
                            ? <span className="text-xs text-emerald-600">✓ Accepted</span>
                            : <span className="text-xs text-amber-600">⏳ Pending</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {c.coi_file_url
                            ? <a href={c.coi_file_url} target="_blank" rel="noreferrer" className="text-[var(--bx-brass)] hover:underline text-xs">View</a>
                            : <span className="text-slate text-xs">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Payments tab ────────────────────────────────────────────────────────── */}
        {activeTab === "payments" && (
          <div className="space-y-3">
            <div className="bx-glass rounded-xl overflow-hidden">
              {paymentsLoading && <p className="p-8 text-center text-slate text-sm animate-pulse">Loading…</p>}
              {loadErr.payments && <div className="p-4"><LoadError what="payments" message={loadErr.payments} onRetry={() => retry("payments")} /></div>}
              {!paymentsLoading && payments.length === 0 && paymentsLoaded && (
                <p className="p-8 text-center text-slate text-sm">No payments recorded yet.</p>
              )}
              {!paymentsLoading && payments.length > 0 && (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-parchment/10 text-xs text-slate uppercase tracking-widest">
                        <th className="text-left px-4 py-3">Booking</th>
                        <th className="text-left px-4 py-3">Renter / Org</th>
                        <th className="text-left px-4 py-3 hidden sm:table-cell">Event</th>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="text-left px-4 py-3">Method</th>
                        <th className="text-left px-4 py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.reservation_id} className="border-b border-parchment/5 hover:bg-parchment/5">
                          <td className="px-4 py-3">
                            <Link href={`/admin/bx-reservations?booking=${p.booking_number}`} className="text-[var(--bx-brass)] hover:underline font-mono text-xs">
                              {p.booking_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-parchment font-medium">{p.contact_name}</p>
                            {p.contact_org && <p className="text-xs text-slate">{p.contact_org}</p>}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-parchment/80">{p.event_name}</td>
                          <td className="px-4 py-3 text-slate text-xs">
                            {new Date(p.payment_received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-parchment">
                            ${p.payment_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-parchment/80 capitalize">{p.payment_method}</td>
                          <td className="px-4 py-3">
                            {p.payment_receipt_url
                              ? <a href={p.payment_receipt_url} target="_blank" rel="noreferrer" className="text-[var(--bx-brass)] hover:underline text-xs">View</a>
                              : <span className="text-slate text-xs">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-parchment/20">
                        <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-widest">
                          Total ({payments.length} payment{payments.length !== 1 ? "s" : ""})
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-parchment">
                          ${totalPayments.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
