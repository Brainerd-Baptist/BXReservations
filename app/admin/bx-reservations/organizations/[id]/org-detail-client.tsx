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

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percent: "Percent",
  flat_dollar: "Flat Dollar",
  room_rate_override: "Rate Override",
};

const DISCOUNT_REASON_LABELS: Record<string, string> = {
  bbs_default: "BBS Default",
  bx_ministry_initiative: "BX Ministry Initiative",
  nonprofit_partner: "Non-Profit Partner",
  staff_courtesy: "Staff Courtesy",
  other: "Other",
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDiscountValue(d: DiscountRule) {
  if (d.type === "percent") return `${d.value}%`;
  if (d.type === "flat_dollar") return fmt(d.value);
  return `${fmt(d.value)}/hr`;
}

// ─── Discount form state ───────────────────────────────────────────────────
interface DiscountFormState {
  type: "percent" | "flat_dollar" | "room_rate_override";
  value: string;
  scope: "all_rooms" | "specific_room";
  room_id: string;
  discount_reason: string;
  note: string;
}

const EMPTY_DISCOUNT_FORM: DiscountFormState = {
  type: "percent",
  value: "",
  scope: "all_rooms",
  room_id: "",
  discount_reason: "",
  note: "",
};

// ─── Discount form modal ───────────────────────────────────────────────────
function DiscountFormModal({
  orgId,
  editingDiscount,
  onClose,
  onSaved,
}: {
  orgId: string;
  editingDiscount: DiscountRule | null;
  onClose: () => void;
  onSaved: (d: DiscountRule, isEdit: boolean) => void;
}) {
  const [form, setForm] = useState<DiscountFormState>(
    editingDiscount
      ? {
          type: editingDiscount.type,
          value: String(editingDiscount.value),
          scope: editingDiscount.scope,
          room_id: editingDiscount.room_id ?? "",
          discount_reason: editingDiscount.discount_reason ?? "",
          note: editingDiscount.note ?? "",
        }
      : EMPTY_DISCOUNT_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bx-ink-soft, #111)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 14,
    color: "var(--bx-parchment)",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numValue = parseFloat(form.value);
    if (isNaN(numValue) || numValue < 0) {
      setError("Value must be a non-negative number.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        value: numValue,
        scope: form.scope,
        room_id: form.scope === "specific_room" ? form.room_id || null : null,
        discount_reason: form.discount_reason || null,
        note: form.note || null,
      };
      const url = editingDiscount
        ? `/api/bx/organizations/${orgId}/discounts/${editingDiscount.id}`
        : `/api/bx/organizations/${orgId}/discounts`;
      const res = await fetch(url, {
        method: editingDiscount ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); setSaving(false); return; }
      onSaved(json.discount, !!editingDiscount);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#1a1a22", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "var(--bx-parchment)" }}>
          {editingDiscount ? "Edit Discount Rule" : "Add Discount Rule"}
        </h2>

        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(220,38,38,0.1)", border: "1px solid var(--bx-clay)", borderRadius: 8, color: "var(--bx-clay)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Type *
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DiscountFormState["type"] }))}
                style={inputStyle}
                required
              >
                <option value="percent">Percent (%)</option>
                <option value="flat_dollar">Flat Dollar ($)</option>
                <option value="room_rate_override">Rate Override ($/hr)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Value * {form.type === "percent" ? "(%)" : "($)"}
              </label>
              <input
                type="number"
                min="0"
                step={form.type === "percent" ? "1" : "0.01"}
                max={form.type === "percent" ? "100" : undefined}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.type === "percent" ? "e.g. 100" : "e.g. 250.00"}
                style={inputStyle}
                required
              />
            </div>
          </div>

          {/* Scope */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Scope *
              </label>
              <select
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as DiscountFormState["scope"] }))}
                style={inputStyle}
              >
                <option value="all_rooms">All Rooms</option>
                <option value="specific_room">Specific Room</option>
              </select>
            </div>
            {form.scope === "specific_room" && (
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                  Room ID *
                </label>
                <input
                  type="text"
                  value={form.room_id}
                  onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))}
                  placeholder="Room UUID or name"
                  style={inputStyle}
                  required={form.scope === "specific_room"}
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Reason
            </label>
            <select
              value={form.discount_reason}
              onChange={(e) => setForm((f) => ({ ...f, discount_reason: e.target.value }))}
              style={inputStyle}
            >
              <option value="">— select a reason (optional) —</option>
              <option value="bbs_default">BBS Default</option>
              <option value="bx_ministry_initiative">BX Ministry Initiative</option>
              <option value="nonprofit_partner">Non-Profit Partner</option>
              <option value="staff_courtesy">Staff Courtesy</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Note */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Note
            </label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Optional note about this discount rule"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--bx-slate)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ background: saving ? "var(--bx-slate)" : "var(--bx-brass)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving…" : editingDiscount ? "Save Changes" : "Add Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function OrgDetailClient({ org: initialOrg, linkedUsers, reservations, discounts: initialDiscounts }: {
  org: OrgDetail; linkedUsers: LinkedUser[]; reservations: ReservationRow[]; discounts: DiscountRule[];
}) {
  const router = useRouter();
  const [org, setOrg] = useState<OrgDetail>(initialOrg);
  const [discounts, setDiscounts] = useState<DiscountRule[]>(initialDiscounts);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OrgDetail>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"info" | "users" | "bookings" | "discounts">("info");

  // Discount management state
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);
  const [deletingDiscountId, setDeletingDiscountId] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

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

  function handleDiscountSaved(d: DiscountRule, isEdit: boolean) {
    if (isEdit) {
      setDiscounts((prev) => prev.map((x) => (x.id === d.id ? d : x)));
    } else {
      setDiscounts((prev) => [d, ...prev]);
    }
    setShowDiscountModal(false);
    setEditingDiscount(null);
  }

  async function handleDeleteDiscount(discountId: string) {
    setDeletingDiscountId(discountId);
    setDiscountError(null);
    try {
      const res = await fetch(`/api/bx/organizations/${org.id}/discounts/${discountId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setDiscountError(json.error ?? "Failed to delete."); return; }
      setDiscounts((prev) => prev.filter((d) => d.id !== discountId));
    } catch {
      setDiscountError("Network error. Please try again.");
    } finally {
      setDeletingDiscountId(null);
    }
  }

  const tabs = [
    { key: "info", label: "Contact Info" },
    { key: "users", label: `Users (${linkedUsers.length})` },
    { key: "bookings", label: `Bookings (${reservations.length})` },
    { key: "discounts", label: `Discounts (${discounts.length})` },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bx-ink)", color: "var(--bx-parchment)" }}>
      {/* Header */}
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
        {/* ── Info tab ── */}
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

        {/* ── Users tab ── */}
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

        {/* ── Bookings tab ── */}
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

        {/* ── Discounts tab ── */}
        {activeTab === "discounts" && (
          <div>
            {/* Header row with add button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Default Discount Rules</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--bx-slate)" }}>
                  These rules automatically apply to all bookings from this organization unless overridden per-booking.
                </p>
              </div>
              <button
                onClick={() => { setEditingDiscount(null); setShowDiscountModal(true); }}
                style={{ background: "var(--bx-brass)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                + Add Rule
              </button>
            </div>

            {discountError && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(220,38,38,0.1)", border: "1px solid var(--bx-clay)", borderRadius: 8, color: "var(--bx-clay)", fontSize: 13 }}>
                {discountError}
              </div>
            )}

            {discounts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--bx-slate)", fontSize: 15, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
                <p style={{ margin: "0 0 12px" }}>No discount rules for this organization.</p>
                <button
                  onClick={() => { setEditingDiscount(null); setShowDiscountModal(true); }}
                  style={{ background: "var(--bx-brass)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >
                  Add the first rule
                </button>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Type", "Value", "Scope", "Reason", "Note", "Added", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bx-slate)", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {discounts.map((d) => (
                    <tr key={d.id}>
                      <Td>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 12, background: "rgba(0,171,201,0.12)", color: "var(--bx-brass)" }}>
                          {DISCOUNT_TYPE_LABELS[d.type] ?? d.type}
                        </span>
                      </Td>
                      <Td><span style={{ fontWeight: 700, color: "var(--bx-sage)" }}>{fmtDiscountValue(d)}</span></Td>
                      <Td muted>{d.scope === "specific_room" && d.room_id ? `Room: ${d.room_id.slice(0, 8)}…` : "All rooms"}</Td>
                      <Td muted>{d.discount_reason ? (DISCOUNT_REASON_LABELS[d.discount_reason] ?? d.discount_reason) : "—"}</Td>
                      <Td muted>{d.note ?? "—"}</Td>
                      <Td muted>{fmtDate(d.created_at)}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => { setEditingDiscount(d); setShowDiscountModal(true); }}
                            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--bx-parchment)", fontWeight: 600 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { if (confirm("Delete this discount rule?")) handleDeleteDiscount(d.id); }}
                            disabled={deletingDiscountId === d.id}
                            style={{ background: "transparent", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: deletingDiscountId === d.id ? "not-allowed" : "pointer", color: "var(--bx-clay)", fontWeight: 600 }}
                          >
                            {deletingDiscountId === d.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Discount form modal */}
      {showDiscountModal && (
        <DiscountFormModal
          orgId={org.id}
          editingDiscount={editingDiscount}
          onClose={() => { setShowDiscountModal(false); setEditingDiscount(null); }}
          onSaved={handleDiscountSaved}
        />
      )}
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
