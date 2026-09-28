"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrgDetail, LinkedUser, ReservationRow, DiscountRule } from "./page";

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  internal: { bg: "rgba(0,32,91,0.12)", text: "var(--bx-parchment)", label: "Internal" },
  bbs: { bg: "rgba(5,150,105,0.12)", text: "var(--bx-sage)", label: "BBS" },
  external: { bg: "rgba(107,114,128,0.12)", text: "var(--bx-slate)", label: "External" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  approved: { bg: "rgba(5,150,105,0.12)", text: "var(--bx-sage)" },
  pending: { bg: "rgba(0,171,201,0.12)", text: "var(--bx-brass)" },
  denied: { bg: "rgba(220,38,38,0.12)", text: "var(--bx-clay)" },
  cancelled: { bg: "rgba(107,114,128,0.12)", text: "var(--bx-slate)" },
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OrgDetailClient({ org: initialOrg, linkedUsers, reservations, discounts }: {
  org: OrgDetail; linkedUsers: LinkedUser[]; reservations: ReservationRow[]; discounts: DiscountRule[];
}) {
  const router = useRouter();
  const [org, setOrg] = useState<OrgDetail>(initialOrg);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OrgDetail>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"info" | "users" | "bookings" | "discounts">("info");

  const tier = TIER_STYLES[org.tier] ?? TIER_STYLES.external;

  function startEdit() {
    setEditForm({ name: org.name, canonical_name: org.canonical_name ?? "", primary_contact_name: org.primary_contact_name ?? "", primary_contact_email: org.primary_contact_email ?? "", phone: org.phone ?? "", address: org.address ?? "", tier: org.tier, notes: org.notes ?? "" });
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/bx/organizations/${org.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
        const json = await res.json();
        if (!res.ok) { setSaveError(json.error ?? "Failed to save."); return; }
        setOrg(json.organization);
        setEditing(false);
        router.refresh();
      } catch {
        setSaveError("Network error. Please try again.");
      }
    });
  }

  const tabs = [
    { key: "info", label: "Contact Info" },
    { key: "users", label: `Users (${linkedUsers.length})` },
    { key: "bookings", label: `Bookings (${reservations.length})` },
    { key: "discounts", label: `Discounts (${discounts.length})` },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bx-ink)", color: "var(--bx-parchment)" }}>
      <div style={{ borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)", padding: "20px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Link href="/admin/bx-reservations/organizations" style={{ fontSize: 13, color: "var(--bx-slate)", textDecoration: "none" }}>Organizations</Link>
          <span style={{ color: "var(--bx-slate)", fontSize: 13 }}>›</span>
          <span style={{ fontSize: 13, color: "var(--bx-parchment)" }}>{org.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{org.name}</h1>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 20, background: tier.bg, color: tier.text }}>{tier.label}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {!editing ? (
              <button onClick={startEdit} style={{ background: "var(--bx-brass)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Edit</button>
            ) : (
              <>
                <button form="org-edit-form" type="submit" disabled={isPending} style={{ background: isPending ? "var(--bx-slate)" : "var(--bx-sage)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 14, cursor: isPending ? "not-allowed" : "pointer" }}>{isPending ? "Saving…" : "Save"}</button>
                <button onClick={() => { setEditing(false); setSaveError(null); }} style={{ background: "transparent", border: "1px solid color-mix(in srgb, var(--bx-parchment) 20%, transparent)", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--bx-slate)" }}>Cancel</button>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ background: "none", border: "none", borderBottom: activeTab === t.key ? "2px solid var(--bx-brass)" : "2px solid transparent", padding: "10px 18px", fontWeight: activeTab === t.key ? 700 : 500, fontSize: 14, cursor: "pointer", color: activeTab === t.key ? "var(--bx-brass)" : "var(--bx-slate)", transition: "all 0.15s", marginBottom: -1 }}>{t.label}</button>
          ))}
        </div>
      </div>

      {saveError && (
        <div style={{ margin: "16px 32px 0", padding: "10px 14px", background: "color-mix(in srgb, var(--bx-clay) 10%, transparent)", border: "1px solid var(--bx-clay)", borderRadius: 8, color: "var(--bx-clay)", fontSize: 13 }}>{saveError}</div>
      )}

      <div style={{ padding: "28px 32px" }}>
        {activeTab === "info" && (
          editing ? (
            <form id="org-edit-form" onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                <EditField label="Organization Name *" value={editForm.name ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} required />
                <EditField label="Canonical Name (slug)" value={editForm.canonical_name ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, canonical_name: v }))} hint="Lowercase identifier used for dedup matching" />
                <EditSelectField label="Tier" value={editForm.tier ?? "external"} onChange={(v) => setEditForm((f) => ({ ...f, tier: v as OrgDetail["tier"] }))} options={[{ value: "external", label: "External" }, { value: "internal", label: "Internal (BBC Ministry)" }, { value: "bbs", label: "BBS" }]} />
                <EditField label="Primary Contact Name" value={editForm.primary_contact_name ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, primary_contact_name: v }))} />
                <EditField label="Contact Email" type="email" value={editForm.primary_contact_email ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, primary_contact_email: v }))} />
                <EditField label="Phone" type="tel" value={editForm.phone ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} />
                <EditField label="Address" value={editForm.address ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, address: v }))} />
                <div style={{ gridColumn: "1 / -1" }}><EditField label="Notes" value={editForm.notes ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, notes: v }))} multiline /></div>
              </div>
            </form>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
              <InfoField label="Organization Name" value={org.name} />
              <InfoField label="Canonical Name" value={org.canonical_name} />
              <InfoField label="Tier" value={tier.label} />
              <InfoField label="Primary Contact" value={org.primary_contact_name} />
              <InfoField label="Contact Email" value={org.primary_contact_email} />
              <InfoField label="Phone" value={org.phone} />
              <InfoField label="Address" value={org.address} />
              {org.notes && <div style={{ gridColumn: "1 / -1" }}><InfoField label="Notes" value={org.notes} /></div>}
              <InfoField label="Created" value={fmtDate(org.created_at)} />
              <InfoField label="Last Updated" value={fmtDate(org.updated_at)} />
            </div>
          )
        )}

        {activeTab === "users" && (
          <div>
            {linkedUsers.length === 0 ? <EmptyState message="No users linked to this organization." /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Name", "Email", "Linked"].map((h) => <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bx-slate)", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>{h}</th>)}</tr></thead>
                <tbody>{linkedUsers.map((u) => <tr key={u.user_id}><Td>{u.display_name ?? "—"}</Td><Td>{u.email}</Td><Td muted>{fmtDate(u.linked_at)}</Td></tr>)}</tbody>
              </table>
            )}
            <p style={{ marginTop: 16, fontSize: 12, color: "var(--bx-slate)", fontStyle: "italic" }}>User linking is managed from the Users page.</p>
          </div>
        )}

        {activeTab === "bookings" && (
          <div>
            {reservations.length === 0 ? <EmptyState message="No bookings linked to this organization." /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Booking #", "Event", "Status", "Contact", "Rack Rate", "Net", "Date"].map((h) => <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bx-slate)", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {reservations.map((r) => {
                    const statusStyle = STATUS_STYLES[r.status ?? ""] ?? STATUS_STYLES.cancelled;
                    return (
                      <tr key={r.id}>
                        <Td><Link href="/admin/bx-reservations?tab=requests" style={{ color: "var(--bx-brass)", textDecoration: "none", fontWeight: 600 }}>{r.booking_number ?? r.id.slice(0, 8)}</Link></Td>
                        <Td>{r.event_name ?? "—"}</Td>
                        <Td><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 12, background: statusStyle.bg, color: statusStyle.text }}>{r.status ?? "unknown"}</span></Td>
                        <Td muted>{r.contact_name ?? "—"}</Td>
                        <Td muted>{fmt(r.rack_rate_total)}</Td>
                        <Td>{fmt(r.net_amount)}</Td>
                        <Td muted>{fmtDate(r.created_at)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "discounts" && (
          <div>
            {discounts.length === 0 ? <EmptyState message="No default discount rules for this organization." /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Type", "Value", "Scope", "Reason", "Note", "Created"].map((h) => <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bx-slate)", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {discounts.map((d) => (
                    <tr key={d.id}>
                      <Td><span style={{ textTransform: "capitalize" }}>{d.type.replace("_", " ")}</span></Td>
                      <Td>{d.type === "percent" ? `${d.value}%` : d.type === "flat_dollar" ? fmt(d.value) : `${fmt(d.value)}/hr`}</Td>
                      <Td muted>{d.scope === "specific_room" && d.room_id ? `Room: ${d.room_id}` : "All rooms"}</Td>
                      <Td muted>{d.discount_reason?.replace(/_/g, " ") ?? "—"}</Td>
                      <Td muted>{d.note ?? "—"}</Td>
                      <Td muted>{fmtDate(d.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ marginTop: 16, fontSize: 12, color: "var(--bx-slate)", fontStyle: "italic" }}>Discount UI coming in Phase 4.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bx-slate)" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 15, color: "var(--bx-parchment)" }}>{value || <span style={{ color: "var(--bx-slate)" }}>—</span>}</p>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text", required, hint, multiline }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; hint?: string; multiline?: boolean }) {
  const inputStyle: React.CSSProperties = { width: "100%", background: "var(--bx-ink-soft)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "var(--bx-parchment)", fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {multiline ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} /> : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} style={inputStyle} />}
      {hint && <p style={{ margin: 0, fontSize: 11, color: "var(--bx-slate)" }}>{hint}</p>}
    </div>
  );
}

function EditSelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ background: "var(--bx-ink-soft)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "var(--bx-parchment)", fontFamily: "inherit", outline: "none" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <td style={{ padding: "12px 12px", fontSize: 14, color: muted ? "var(--bx-slate)" : "var(--bx-parchment)", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)", verticalAlign: "middle" }}>{children}</td>;
}

function EmptyState({ message }: { message: string }) {
  return <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--bx-slate)", fontSize: 15 }}>{message}</div>;
}
