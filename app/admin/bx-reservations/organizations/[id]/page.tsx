"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Org {
  id: string;
  name: string;
  canonical_name: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

interface Reservation {
  id: string;
  booking_number: string;
  contact_name: string;
  contact_email: string;
  event_name: string;
  status: string;
  created_at: string;
  coi_expiry_date: string | null;
  coi_accepted_at: string | null;
  coi_uploaded_at: string | null;
  payment_received_at: string | null;
  payment_amount: number | null;
  payload: Record<string, unknown>;
  cancelled_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending: "Requested", under_review: "Proposal Sent", needs_info: "Needs Info",
  pending_documents: "Pending Documents", pending_payment: "Pending Payment",
  approved: "Deposit Received", confirmed: "Confirmed", completed: "Completed",
  cancelled: "Declined", cancelled_by_admin: "Cancelled by BX",
  cancelled_by_user: "Cancelled by User", auto_cancelled: "Expired",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400", under_review: "bg-indigo-400", needs_info: "bg-orange-400",
  pending_documents: "bg-orange-400", pending_payment: "bg-orange-400",
  approved: "bg-emerald-400", confirmed: "bg-emerald-500", completed: "bg-slate-400",
  cancelled: "bg-red-400", cancelled_by_admin: "bg-red-400",
  cancelled_by_user: "bg-slate-400", auto_cancelled: "bg-slate-400",
};

function coiChipStyle(expiryDate: string | null, accepted: string | null) {
  if (!accepted) return "bg-slate-100 text-slate-500 border-slate-200";
  if (!expiryDate) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0)  return "bg-red-100 text-red-700 border-red-200";
  if (days < 30) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function coiLabel(expiryDate: string | null, accepted: string | null) {
  if (!accepted) return "No COI";
  if (!expiryDate) return "COI ✓";
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  const d = new Date(expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (days < 0)  return `COI expired ${d}`;
  return `COI to ${d}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrgProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [org, setOrg] = useState<Org | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/organizations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setOrg(d.organization);
        setReservations(d.reservations ?? []);
        setLoading(false);
      });
  }, [id]);

  function openEdit() {
    if (!org) return;
    setEditName(org.name);
    setEditContact(org.primary_contact_name ?? "");
    setEditEmail(org.primary_contact_email ?? "");
    setEditPhone(org.phone ?? "");
    setEditNotes(org.notes ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        primary_contact_name: editContact.trim() || null,
        primary_contact_email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        notes: editNotes.trim() || null,
      }),
    });
    const d = await res.json();
    if (d.organization) { setOrg(d.organization); setEditing(false); }
    setSaving(false);
  }

  async function deleteOrg() {
    if (!confirm(`Delete "${org?.name}"? This will unlink all reservations.`)) return;
    await fetch(`/api/admin/organizations/${id}`, { method: "DELETE" });
    router.push("/admin/bx-reservations/organizations");
  }

  // Derive latest valid COI across all reservations
  const latestCOI = reservations
    .filter((r) => r.coi_accepted_at && r.coi_expiry_date)
    .sort((a, b) => (b.coi_expiry_date ?? "").localeCompare(a.coi_expiry_date ?? ""))[0] ?? null;

  const coiDaysLeft = latestCOI?.coi_expiry_date
    ? Math.floor((new Date(latestCOI.coi_expiry_date).getTime() - Date.now()) / 86_400_000)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <div className="text-slate/50 text-sm">Loading…</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate/70 mb-4">Organization not found.</p>
          <Link href="/admin/bx-reservations/organizations" className="text-blue-600 hover:underline text-sm">← Back to Organizations</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="text-sm text-slate/60">
          <Link href="/admin/bx-reservations" className="hover:text-slate">Reservations</Link>
          {" › "}
          <Link href="/admin/bx-reservations/organizations" className="hover:text-slate">Organizations</Link>
          {" › "}
          <span className="text-ink">{org.name}</span>
        </div>

        {/* Org header card */}
        <div className="bg-white rounded-2xl border border-parchment/20 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-ink">{org.name}</h1>
              {org.primary_contact_name && (
                <p className="text-sm text-slate/70 mt-1">{org.primary_contact_name}</p>
              )}
              {org.primary_contact_email && (
                <a href={`mailto:${org.primary_contact_email}`} className="text-sm text-blue-600 hover:underline">{org.primary_contact_email}</a>
              )}
              {org.phone && <p className="text-sm text-slate/70 mt-0.5">{org.phone}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={openEdit} className="px-4 py-2 rounded-lg border border-parchment/30 text-sm text-slate hover:bg-parchment/30 transition-colors">Edit</button>
              <button onClick={deleteOrg} className="px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">Delete</button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-parchment/20">
            <div className="text-center">
              <p className="text-2xl font-bold text-ink">{reservations.length}</p>
              <p className="text-xs text-slate/60">Reservations</p>
            </div>
            {reservations.length > 0 && (
              <div className="text-center">
                <p className="text-sm font-semibold text-ink">
                  {new Date(reservations[reservations.length - 1].created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </p>
                <p className="text-xs text-slate/60">First booking</p>
              </div>
            )}
            {latestCOI && (
              <div className="text-center">
                <p className={`text-sm font-semibold ${coiDaysLeft !== null && coiDaysLeft < 0 ? "text-red-600" : coiDaysLeft !== null && coiDaysLeft < 30 ? "text-amber-600" : "text-emerald-600"}`}>
                  {coiDaysLeft !== null && coiDaysLeft < 0 ? "Expired" : coiDaysLeft !== null && coiDaysLeft < 30 ? `${coiDaysLeft}d left` : "Valid"}
                </p>
                <p className="text-xs text-slate/60">COI status</p>
              </div>
            )}
          </div>

          {/* COI carry-forward banner */}
          {latestCOI && coiDaysLeft !== null && coiDaysLeft >= 0 && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              <span className="font-medium">Valid COI on file</span> — expires{" "}
              {new Date(latestCOI.coi_expiry_date!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
              {" "}No new upload required unless coverage has changed.
            </div>
          )}

          {latestCOI && coiDaysLeft !== null && coiDaysLeft < 0 && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              <span className="font-medium">COI on file is expired</span> — expired{" "}
              {new Date(latestCOI.coi_expiry_date!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
              {" "}A fresh COI is required for upcoming reservations.
            </div>
          )}

          {/* Admin notes */}
          {org.notes && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-parchment/40 border border-parchment/30 text-sm text-slate">
              <p className="text-xs font-medium text-slate/50 mb-1">Admin notes</p>
              <p className="whitespace-pre-wrap">{org.notes}</p>
            </div>
          )}
        </div>

        {/* Reservations list */}
        <div>
          <h2 className="text-base font-semibold text-ink mb-3">Reservation History</h2>
          {reservations.length === 0 ? (
            <p className="text-sm text-slate/50">No reservations linked to this organization.</p>
          ) : (
            <div className="space-y-2">
              {reservations.map((r) => {
                const eventDates = (r.payload?.dates as string[] | undefined) ?? [];
                const firstDate = eventDates[0]
                  ? new Date(eventDates[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : null;
                return (
                  <Link
                    key={r.id}
                    href={`/admin/bx-reservations/${r.id}`}
                    className="flex items-center justify-between gap-4 bg-white rounded-xl border border-parchment/20 px-5 py-3.5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[r.status] ?? "bg-slate-300"}`} />
                        <span className="font-medium text-ink text-sm group-hover:text-blue-700 transition-colors truncate">{r.event_name}</span>
                      </div>
                      <p className="text-xs text-slate/60 mt-0.5 ml-4">
                        #{r.booking_number} · {STATUS_LABEL[r.status] ?? r.status}
                        {firstDate ? ` · ${firstDate}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${coiChipStyle(r.coi_expiry_date, r.coi_accepted_at)}`}>
                        {coiLabel(r.coi_expiry_date, r.coi_accepted_at)}
                      </span>
                      {r.payment_received_at && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
                          Paid {r.payment_amount ? `$${Number(r.payment_amount).toLocaleString()}` : ""}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink mb-4">Edit Organization</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Name *</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Primary Contact Name</label>
                <input type="text" value={editContact} onChange={(e) => setEditContact(e.target.value)}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Email</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Phone</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Admin Notes</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Anything useful to remember about this org…" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(false)}
                className="flex-1 py-2 rounded-lg border border-parchment/30 text-sm text-slate hover:bg-parchment/20 transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving || !editName.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
