"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { OrgListSkeleton } from "@/app/components/Skeleton";

interface Org {
  id: string;
  name: string;
  canonical_name: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  reservation_count: number;
  latest_reservation_at: string | null;
  has_coi: boolean;
  coi_expiry_date: string | null;
}

function coiChip(org: Org) {
  if (!org.has_coi) return null;
  const expiry = org.coi_expiry_date;
  if (!expiry) return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">COI on file</span>;
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0)  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">COI expired</span>;
  if (days < 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">COI expiring soon</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">COI valid</span>;
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Create org modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/organizations")
      .then((r) => r.json())
      .then((d) => { setOrgs(d.organizations ?? []); setLoading(false); });
  }, []);

  const filtered = q.trim()
    ? orgs.filter(
        (o) =>
          o.name.toLowerCase().includes(q.toLowerCase()) ||
          (o.primary_contact_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (o.primary_contact_email ?? "").toLowerCase().includes(q.toLowerCase()),
      )
    : orgs;

  async function createOrg() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), primary_contact_email: newEmail || undefined, phone: newPhone || undefined }),
    });
    const d = await res.json();
    if (d.organization) {
      setOrgs((prev) => [{ ...d.organization, reservation_count: 0, latest_reservation_at: null, has_coi: false, coi_expiry_date: null }, ...prev]);
      setShowCreate(false);
      setNewName(""); setNewEmail(""); setNewPhone("");
    }
    setCreating(false);
  }

  return (
    <div className="animate-in min-h-screen bg-parchment px-4 py-8 md:px-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/bx-reservations" className="text-sm text-slate/60 hover:text-slate mb-1 block">← Reservations</Link>
            <h1 className="text-2xl font-bold text-ink">Organizations</h1>
            <p className="text-sm text-slate/70 mt-0.5">{orgs.length} known organization{orgs.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Org
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search organizations…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-parchment/30 bg-white text-sm text-ink placeholder:text-slate/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
        </div>

        {/* List */}
        {loading ? (
          <OrgListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <div className="text-slate/50 text-sm py-8 text-center">{q ? "No matches" : "No organizations yet"}</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((org) => (
              <Link
                key={org.id}
                href={`/admin/bx-reservations/organizations/${org.id}`}
                className="block bg-white rounded-xl border border-parchment/20 px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink group-hover:text-blue-700 transition-colors">{org.name}</span>
                      {coiChip(org)}
                    </div>
                    {org.primary_contact_name && (
                      <p className="text-sm text-slate/70 mt-0.5">{org.primary_contact_name}{org.primary_contact_email ? ` · ${org.primary_contact_email}` : ""}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-slate">{org.reservation_count} reservation{org.reservation_count !== 1 ? "s" : ""}</p>
                    {org.latest_reservation_at && (
                      <p className="text-xs text-slate/50 mt-0.5">
                        Last: {new Date(org.latest_reservation_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink mb-4">New Organization</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Organization Name *</label>
                <input
                  type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. First Presbyterian Church"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Primary Contact Email</label>
                <input
                  type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="contact@example.org"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate/70 mb-1">Phone</label>
                <input
                  type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full border border-parchment/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="(423) 555-1234"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowCreate(false); setNewName(""); setNewEmail(""); setNewPhone(""); }}
                className="flex-1 py-2 rounded-lg border border-parchment/30 text-sm text-slate hover:bg-parchment/20 transition-colors"
              >Cancel</button>
              <button
                onClick={createOrg} disabled={creating || !newName.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >{creating ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
