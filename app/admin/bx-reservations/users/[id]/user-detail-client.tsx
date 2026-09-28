"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Calendar, Building2,
  Check, X, Pencil, Loader2, ChevronDown,
} from "lucide-react";
import {
  ROLES_ORDERED, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_RANK, type BxRole,
} from "@/lib/roles";
import type { UserAuth, UserProfile, UserReservation, LinkedOrg } from "./page";

function fmt(iso: string | null, fallback = "Never"): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function relTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(d / 60_000);
  const hours = Math.floor(d / 3_600_000);
  const days = Math.floor(d / 86_400_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmt(iso);
}

function dollars(n: number | null): string {
  if (n == null) return "\u2014";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const text = name ?? email;
  const parts = text.trim().split(/\s+/);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : text.slice(0, 2);
  const hue = email.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 uppercase"
      style={{ background: `hsl(${hue} 35% 25%)`, color: `hsl(${hue} 60% 75%)`, border: `1px solid hsl(${hue} 40% 35%)` }}>
      {letters.toUpperCase()}
    </div>
  );
}

const ROLE_COLORS: Record<BxRole, { bg: string; text: string }> = {
  owner:                { bg: "rgba(217,119,6,0.15)",   text: "#f59e0b" },
  system_admin:         { bg: "rgba(124,58,237,0.15)",  text: "#a78bfa" },
  booking_admin:        { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa" },
  ministry_coordinator: { bg: "rgba(20,184,166,0.15)",  text: "#2dd4bf" },
  brainerd_staff:       { bg: "rgba(34,197,94,0.15)",   text: "#4ade80" },
  member:               { bg: "rgba(100,116,139,0.12)", text: "var(--bx-slate)" },
};

function RoleBadge({ role }: { role: BxRole | null }) {
  if (!role) return <span className="text-xs text-slate/50 italic">No role</span>;
  const c = ROLE_COLORS[role];
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: c.bg, color: c.text }}>{ROLE_LABELS[role]}</span>;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  confirmed:  { bg: "rgba(5,150,105,0.12)",  text: "var(--bx-sage)" },
  pending:    { bg: "rgba(217,119,6,0.12)",   text: "#f59e0b" },
  cancelled:  { bg: "rgba(239,68,68,0.12)",   text: "var(--bx-clay)" },
  completed:  { bg: "rgba(100,116,139,0.12)", text: "var(--bx-slate)" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate/40 italic">\u2014</span>;
  const s = STATUS_STYLES[status] ?? { bg: "rgba(100,116,139,0.12)", text: "var(--bx-slate)" };
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ background: s.bg, color: s.text }}>{status}</span>;
}

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  internal: { bg: "rgba(0,32,91,0.18)",    text: "var(--bx-parchment)", label: "Internal" },
  bbs:      { bg: "rgba(5,150,105,0.12)",  text: "var(--bx-sage)",      label: "BBS" },
  external: { bg: "rgba(100,116,139,0.12)", text: "var(--bx-slate)",    label: "External" },
};

function TierBadge({ tier }: { tier: string }) {
  const s = TIER_STYLES[tier] ?? TIER_STYLES.external;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.text }}>{s.label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-xs font-semibold text-slate mb-1">{label}</div>{children}</div>;
}

function ReadValue({ value }: { value: string | null }) {
  return value ? <span className="text-parchment text-sm">{value}</span> : <span className="text-slate/40 text-sm italic">Not set</span>;
}

function RolePicker({ userId, current, callerRole, onSaved }: {
  userId: string; current: BxRole | null; callerRole: BxRole | null; onSaved: (r: BxRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<BxRole | null>(null);
  const callerIsOwner = callerRole === "owner";
  const callerIsSysAdmin = callerRole === "system_admin";
  const assignable = ROLES_ORDERED.filter((r) => {
    if (r === "owner") return callerIsOwner;
    if (callerIsOwner) return true;
    if (callerIsSysAdmin) return r !== "system_admin";  // r already ≠ "owner" here
    return false;
  });
  if (current === "owner" && !callerIsOwner) return <RoleBadge role="owner" />;
  if (!assignable.length) return <RoleBadge role={current} />;
  async function pick(r: BxRole) {
    setPending(r); setSaving(true); setOpen(false);
    try {
      const res = await fetch("/api/bx/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role: r }) });
      if (!res.ok) throw new Error("Failed");
      onSaved(r);
    } catch { alert("Failed to save role."); }
    finally { setSaving(false); setPending(null); }
  }
  const display = saving ? pending ?? current : current;
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--bbc-blue)] border-parchment/20"
        style={display ? { background: ROLE_COLORS[display].bg, color: ROLE_COLORS[display].text } : { background: "rgba(100,116,139,0.12)", color: "var(--bx-slate)" }}>
        {saving ? <><Loader2 size={12} className="animate-spin" />{display ? ROLE_LABELS[display] : "Assigning"}</> : <>{current ? ROLE_LABELS[current] : "Assign role"}<ChevronDown size={12} /></>}
      </button>
      {open && (
        <div className="absolute z-50 left-0 mt-1 w-56 bg-[var(--bx-ink-soft)] border border-parchment/20 rounded-xl shadow-xl py-1">
          {assignable.map((r) => (
            <button key={r} onClick={() => pick(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-parchment/5 flex items-start gap-2 group">
              <Check size={12} className={`mt-0.5 flex-shrink-0 ${current === r ? "text-[var(--bbc-blue)]" : "opacity-0 group-hover:opacity-30"}`} />
              <div>
                <div className="font-semibold text-parchment">{ROLE_LABELS[r]}</div>
                <div className="text-slate text-[11px] leading-tight mt-0.5">{ROLE_DESCRIPTIONS[r]}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = "profile" | "reservations" | "orgs";

export default function UserDetailClient({ authUser, profile: initialProfile, userRole: initialRole, callerRole, reservations, linkedOrgs }: {
  authUser: UserAuth; profile: UserProfile | null; userRole: BxRole | null; callerRole: BxRole | null; reservations: UserReservation[]; linkedOrgs: LinkedOrg[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("profile");
  const [userRole, setUserRole] = useState<BxRole | null>(initialRole);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditForm({ display_name: profile?.display_name ?? "", phone: profile?.phone ?? "", organization: profile?.organization ?? "" });
    setEditing(true);
  }
  function cancelEdit() { setEditing(false); setEditForm({}); }
  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/bx/users/${authUser.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      if (!res.ok) throw new Error("Save failed");
      const json = await res.json();
      setProfile(json.profile); setEditing(false);
      startTransition(() => router.refresh());
    } catch { alert("Failed to save \u2014 try again."); }
    finally { setSaving(false); }
  }

  const displayName = profile?.display_name ?? null;
  const callerRank = callerRole ? ROLE_RANK[callerRole] : 0;
  const canEdit = callerRank >= ROLE_RANK["booking_admin"];
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "profile", label: "Profile" },
    { key: "reservations", label: "Reservations", count: reservations.length },
    { key: "orgs", label: "Organizations", count: linkedOrgs.length },
  ];

  return (
    <div className="min-h-screen bg-[var(--bx-ink)] font-sans">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <nav className="flex items-center gap-2 text-xs text-slate mb-6">
          <Link href="/admin/bx-reservations/users" className="flex items-center gap-1 hover:text-parchment transition-colors">
            <ArrowLeft size={12} />Users
          </Link>
          <span>/</span>
          <span className="text-parchment">{displayName ?? authUser.email}</span>
        </nav>

        <div className="bg-[var(--bx-ink-soft)] border border-parchment/10 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Initials name={displayName} email={authUser.email} />
              <div>
                <h1 className="text-parchment font-bold text-xl leading-tight">
                  {displayName ?? <span className="text-slate italic font-normal">No display name</span>}
                </h1>
                <p className="text-slate text-sm mt-0.5">{authUser.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <RolePicker userId={authUser.id} current={userRole} callerRole={callerRole} onSaved={setUserRole} />
                  {authUser.email_confirmed_at
                    ? <span className="text-xs text-[var(--bx-sage)] bg-[rgba(5,150,105,0.1)] px-2 py-0.5 rounded-full">Confirmed</span>
                    : <span className="text-xs text-amber-400 bg-[rgba(217,119,6,0.1)] px-2 py-0.5 rounded-full">Pending confirmation</span>}
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {editing ? (
                  <>
                    <button onClick={cancelEdit} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate hover:text-parchment rounded-lg border border-parchment/15 transition-colors">
                      <X size={13} /> Cancel
                    </button>
                    <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--bbc-blue)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                    </button>
                  </>
                ) : (
                  <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate hover:text-parchment rounded-lg border border-parchment/15 transition-colors">
                    <Pencil size={13} /> Edit
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-parchment/8 flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-xs text-slate"><span className="font-semibold">Joined</span> {fmt(authUser.created_at)}</span>
            <span className="text-xs text-slate"><span className="font-semibold">Last active</span> {relTime(authUser.last_sign_in_at)}</span>
            <span className="text-xs text-slate font-mono opacity-40">{authUser.id.slice(0, 8)}\u2026</span>
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-parchment/10">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-all -mb-px ${tab === t.key ? "border-[var(--bbc-blue)] text-[var(--bbc-blue)]" : "border-transparent text-slate hover:text-parchment"}`}>
              {t.label}{t.count != null && t.count > 0 && <span className="ml-1.5 text-xs opacity-60">({t.count})</span>}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="bg-[var(--bx-ink-soft)] border border-parchment/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5"><User size={15} className="text-slate" /><h2 className="text-parchment font-semibold text-sm">Profile information</h2></div>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Display name">
                {editing ? <input value={editForm.display_name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Full name" className="w-full bg-[var(--bx-ink)] border border-parchment/15 text-parchment text-sm rounded-lg px-3 py-2 placeholder-slate/50 focus:outline-none focus:ring-2 focus:ring-[var(--bbc-blue)]" /> : <ReadValue value={profile?.display_name ?? null} />}
              </Field>
              <Field label="Email"><span className="text-parchment text-sm">{authUser.email}</span></Field>
              <Field label="Phone">
                {editing ? <input value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" className="w-full bg-[var(--bx-ink)] border border-parchment/15 text-parchment text-sm rounded-lg px-3 py-2 placeholder-slate/50 focus:outline-none focus:ring-2 focus:ring-[var(--bbc-blue)]" /> : <ReadValue value={profile?.phone ?? null} />}
              </Field>
              <Field label="Organization (text)">
                {editing ? <input value={editForm.organization ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, organization: e.target.value }))} placeholder="e.g. First Baptist, Blank" className="w-full bg-[var(--bx-ink)] border border-parchment/15 text-parchment text-sm rounded-lg px-3 py-2 placeholder-slate/50 focus:outline-none focus:ring-2 focus:ring-[var(--bbc-blue)]" /> : <ReadValue value={profile?.organization ?? null} />}
              </Field>
              <Field label="Role"><RoleBadge role={userRole} /></Field>
              <Field label="Account status">
                {authUser.email_confirmed_at ? <span className="text-[var(--bx-sage)] text-sm">Active</span> : <span className="text-amber-400 text-sm">Pending email confirmation</span>}
              </Field>
            </div>
          </div>
        )}

        {tab === "reservations" && (
          <div className="bg-[var(--bx-ink-soft)] border border-parchment/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-parchment/8">
              <Calendar size={15} className="text-slate" /><h2 className="text-parchment font-semibold text-sm">Reservations</h2>
              <span className="text-xs text-slate ml-auto">{reservations.length} shown (max 25)</span>
            </div>
            {reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <Calendar size={28} className="text-slate/30 mb-3" />
                <p className="text-parchment font-semibold text-sm">No reservations</p>
                <p className="text-slate text-xs mt-1">This user has not made any bookings yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-parchment/8 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate">Event</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate hidden md:table-cell">Rack</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate hidden md:table-cell">Net</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate">Date</th>
                </tr></thead>
                <tbody className="divide-y divide-parchment/5">
                  {reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-parchment/3 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-parchment text-xs leading-tight">{r.event_name ?? "\u2014"}</div>
                        {r.booking_number && <div className="text-[11px] text-slate mt-0.5 font-mono">{r.booking_number}</div>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate">{dollars(r.rack_rate_total)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate">{dollars(r.net_amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate">{fmt(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "orgs" && (
          <div className="bg-[var(--bx-ink-soft)] border border-parchment/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-parchment/8">
              <Building2 size={15} className="text-slate" /><h2 className="text-parchment font-semibold text-sm">Linked organizations</h2>
            </div>
            {linkedOrgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <Building2 size={28} className="text-slate/30 mb-3" />
                <p className="text-parchment font-semibold text-sm">No organizations linked</p>
                <p className="text-slate text-xs mt-1">This user isn&apos;t associated with any organization yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-parchment/5">
                {linkedOrgs.map((o) => (
                  <div key={o.org_id} className="flex items-center justify-between px-5 py-4 hover:bg-parchment/3 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--bx-ink)] border border-parchment/10 flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-slate" />
                      </div>
                      <div>
                        <Link href={`/admin/bx-reservations/organizations/${o.org_id}`} className="text-parchment font-semibold text-sm hover:text-[var(--bbc-blue)] transition-colors">{o.name}</Link>
                        <div className="text-xs text-slate mt-0.5">Linked {fmt(o.linked_at)}</div>
                      </div>
                    </div>
                    <TierBadge tier={o.tier} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
