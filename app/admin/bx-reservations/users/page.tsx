"use client";

import BodyPortal from "@/app/components/body-portal";
import LoadError from "@/app/components/load-error";
import RolePicker from "@/app/components/role-picker";
import { useModalDialog } from "@/app/components/use-modal-dialog";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, UserPlus, Shield, Check, X, Loader2, Mail, Trash2 } from "lucide-react";
import { can, ROLES_ORDERED, ROLE_LABELS, ROLE_DESCRIPTIONS, type BxRole } from "@/lib/roles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BxUser {
  id: string;
  email: string;
  display_name: string | null;
  organization: string | null;
  role: BxRole | null;
  reservation_count: number;
  last_active: string | null;
}

// ─── Role badge ───────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  2) return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const text = name ?? email;
  const parts = text.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : text.slice(0, 2);
  // Deterministic color from email
  const hue = email.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 uppercase"
      style={{ background: `hsl(${hue} 35% 25%)`, color: `hsl(${hue} 60% 75%)`, border: `1px solid hsl(${hue} 40% 35%)` }}
    >
      {letters.toUpperCase()}
    </div>
  );
}



function RoleBadge({ role }: { role: BxRole | null }) {
  if (!role) return <span className="text-xs text-slate/50 italic">No role</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide border border-parchment/20 bg-parchment/8 text-parchment/70">
      {ROLE_LABELS[role]}
    </span>
  );
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  // Focus trap, Escape, inert background, scroll lock, focus return (audit F02)
  const panelRef = useRef<HTMLDivElement>(null);
  useModalDialog(true, onClose, panelRef);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BxRole>("member");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return;
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    setSending(true);
    try {
      const res = await fetch("/api/bx/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role, name: fullName, organization: org.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      setSent(true);
      setTimeout(() => { onInvited(); onClose(); }, 1500);
    } catch {
      alert("Invite failed — check the email and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <BodyPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="invite-user-title" className="bx-glass-strong rounded-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="invite-user-title" className="text-parchment font-bold text-lg">Invite a user</h2>
            <p className="text-slate text-sm mt-0.5">They'll receive a sign-in link with this role pre-assigned.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate hover:text-parchment p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="users-first-name-1" className="block text-xs font-semibold text-slate mb-1.5">First name <span className="text-red-400">*</span></label>
              <input id="users-first-name-1"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="bx-input"
              />
            </div>
            <div>
              <label htmlFor="users-last-name-2" className="block text-xs font-semibold text-slate mb-1.5">Last name <span className="text-red-400">*</span></label>
              <input id="users-last-name-2"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="bx-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="users-organization-optional-3" className="block text-xs font-semibold text-slate mb-1.5">Organization <span className="font-normal text-slate/60">(optional)</span></label>
              <input id="users-organization-optional-3"
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Organization name"
                className="bx-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="users-email-address-4" className="block text-xs font-semibold text-slate mb-1.5">Email address <span className="text-red-400">*</span></label>
            <input id="users-email-address-4"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="name@example.com"
              className="bx-input"
            />
          </div>

          <div>
            <p id="invite-role-label" className="block text-xs font-semibold text-slate mb-1.5">Role</p>
            <div role="radiogroup" aria-labelledby="invite-role-label" className="space-y-2">
              {(["booking_admin", "ministry_coordinator", "brainerd_staff", "member"] as BxRole[]).map((r) => (
                <label key={r} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${role === r ? "border-[var(--bx-accent-text)] bg-[var(--bx-accent-text)]/5" : "border-parchment/10 hover:border-parchment/25"}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-0.5 accent-[var(--bx-accent-text)]" />
                  <div>
                    <div className="text-parchment text-sm font-semibold">{ROLE_LABELS[r]}</div>
                    <div className="text-slate text-xs mt-0.5">{ROLE_DESCRIPTIONS[r]}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate hover:text-parchment rounded-lg transition-colors">Cancel</button>
          <button
            onClick={send}
            disabled={!email.trim() || !firstName.trim() || !lastName.trim() || sending || sent}
            className="bx-btn bx-btn--primary bx-btn--md"
          >
            {sent ? <><Check size={14} /> Sent!</> : sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Mail size={14} /> Send invite</>}
          </button>
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<BxUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<BxRole | "all">("all");
  const [callerRole, setCallerRole] = useState<BxRole>("system_admin");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // A failed load shows an error with Retry instead of "No users found" (audit F06).
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/bx/users");
      let json: { users?: unknown; callerRole?: string; error?: string } = {};
      try { json = await res.json(); } catch { /* non-JSON error page */ }
      if (!res.ok || !Array.isArray(json.users)) {
        throw new Error(json.error ? `The server said: ${json.error}` : `The server returned an error (${res.status}).`);
      }
      setUsers(json.users as BxUser[]);
      setCallerRole((json.callerRole ?? "system_admin") as typeof callerRole);
    } catch (e) {
      setLoadError(e instanceof Error && !/fetch/i.test(e.message) ? e.message : "Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q) || (u.organization ?? "").toLowerCase().includes(q);
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[var(--bx-accent-text)]/10 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-[var(--bx-accent-text)]" />
            </div>
            <div>
              <h1 className="text-parchment font-bold text-xl">Users</h1>
              <p className="text-slate text-xs mt-0.5">{users.length} accounts</p>
            </div>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="bx-btn bx-btn--primary bx-btn--md"
          >
            <UserPlus size={15} />
            Invite user
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or org…"
              className="bx-input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...ROLES_ORDERED] as (BxRole | "all")[]).map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                aria-pressed={filterRole === r}
                className={`bx-btn bx-btn--sm !rounded-full ${filterRole === r ? "bx-btn--primary" : "bx-btn--secondary"}`}
              >
                {r === "all" ? "All roles" : ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bx-glass rounded-2xl overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading users…</span>
            </div>
          ) : loadError ? (
            <div className="p-4"><LoadError what="users" message={loadError} onRetry={load} /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Shield size={32} className="text-slate/30 mb-3" />
              <p className="text-parchment font-semibold text-sm">No users found</p>
              <p className="text-slate text-xs mt-1">Try adjusting the search or filter</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment/10 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate">User</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate hidden sm:table-cell">Organization</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate hidden md:table-cell">Reservations</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate hidden lg:table-cell">Last active</th>
                  {can.deleteUser(callerRole) && <th className="px-4 py-3 w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment/5">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-parchment/3 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/bx-reservations/users/${u.id}`} className="flex items-center gap-2.5 group">
                        <Initials name={u.display_name} email={u.email} />
                        <div>
                          <div className="font-semibold text-parchment leading-tight group-hover:text-[var(--bx-accent-text)] transition-colors">{u.display_name ?? "—"}</div>
                          <div className="text-xs text-slate mt-0.5 break-all">{u.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-slate text-xs">{u.organization ?? <span className="italic text-slate/40">—</span>}</span>
                    </td>
                    <td className="px-4 py-3">
                      <RolePicker
                        userId={u.id}
                        current={u.role}
                        callerRole={callerRole}
                        badge={<RoleBadge role={u.role} />}
                        onSaved={(newRole) => {
                          setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: newRole } : x));
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(u.reservation_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--bx-accent-text) 12%, transparent)", color: "var(--bx-accent-text)" }}>
                          {u.reservation_count}
                        </span>
                      ) : (
                        <span className="text-slate/40 text-xs italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-xs ${u.last_active ? "text-slate" : "text-slate/40 italic"}`}>{relativeTime(u.last_active)}</span>
                    </td>
                    {can.deleteUser(callerRole) && u.role !== "owner" && (
                      <td className="px-4 py-3">
                        {deleteConfirmId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={async () => {
                                setDeleting(true);
                                try {
                                  const res = await fetch(`/api/admin/users/${u.id}/delete`, { method: "DELETE" });
                                  if (res.ok) {
                                    setUsers((prev) => prev.filter((x) => x.id !== u.id));
                                  } else {
                                    const j = await res.json();
                                    alert(j.error ?? "Delete failed");
                                  }
                                } finally {
                                  setDeleting(false);
                                  setDeleteConfirmId(null);
                                }
                              }}
                              disabled={deleting}
                              className="px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deleting ? "…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 text-xs text-slate hover:text-parchment rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(u.id)}
                            title="Delete user"
                            className="p-1.5 text-slate/40 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    )}
                    {can.deleteUser(callerRole) && u.role === "owner" && (
                      <td className="px-4 py-3" />
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Role legend */}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES_ORDERED.map((r) => (
            <div key={r} className="bx-glass-flat rounded-xl p-3 flex flex-col gap-1">
              <span className="text-xs font-bold text-parchment/80 tracking-wide uppercase">{ROLE_LABELS[r]}</span>
              <p className="text-xs text-slate leading-tight">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => { load(); }}
        />
      )}
    </div>
  );
}
