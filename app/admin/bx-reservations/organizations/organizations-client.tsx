"use client";

import BodyPortal from "@/app/components/body-portal";
import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrgSummary } from "./page";

// ─── Tier config ─────────────────────────────────────────────────────────────
const TIERS = [
  { value: "", label: "All" },
  { value: "internal", label: "Internal" },
  { value: "bbs", label: "BBS" },
  { value: "external", label: "External" },
] as const;

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> =
  {
    internal: {
      bg: "rgba(0,32,91,0.12)",
      text: "var(--bx-parchment)",
      label: "Internal",
    },
    bbs: {
      bg: "rgba(5,150,105,0.12)",
      text: "var(--bx-sage)",
      label: "BBS",
    },
    external: {
      bg: "rgba(107,114,128,0.12)",
      text: "var(--bx-slate)",
      label: "External",
    },
  };

// ─── New Org form state ──────────────────────────────────────────────────────
interface NewOrgForm {
  name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  phone: string;
  address: string;
  tier: "internal" | "bbs" | "external";
  notes: string;
}

const EMPTY_FORM: NewOrgForm = {
  name: "",
  primary_contact_name: "",
  primary_contact_email: "",
  phone: "",
  address: "",
  tier: "external",
  notes: "",
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function OrganizationsClient({
  initialOrganizations,
  fetchError,
}: {
  initialOrganizations: OrgSummary[];
  fetchError: string | null;
}) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgSummary[]>(initialOrganizations);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState<NewOrgForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orgs.filter((o) => {
      const matchesTier = !tierFilter || o.tier === tierFilter;
      const matchesSearch =
        !q ||
        o.name.toLowerCase().includes(q) ||
        (o.canonical_name ?? "").toLowerCase().includes(q) ||
        (o.primary_contact_name ?? "").toLowerCase().includes(q) ||
        (o.primary_contact_email ?? "").toLowerCase().includes(q);
      return matchesTier && matchesSearch;
    });
  }, [orgs, search, tierFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Organization name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/bx/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (!res.ok) {
          setFormError(json.error ?? "Failed to create organization.");
          return;
        }
        const newOrg: OrgSummary = {
          ...json.organization,
          user_count: 0,
          reservation_count: 0,
        };
        setOrgs((prev) => [...prev, newOrg].sort((a, b) => a.name.localeCompare(b.name)));
        setSlideOpen(false);
        setForm(EMPTY_FORM);
        router.push(`/admin/bx-reservations/organizations/${newOrg.id}`);
      } catch {
        setFormError("Network error. Please try again.");
      }
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "var(--bx-parchment)",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
          padding: "24px 32px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bx-slate)", marginBottom: 4 }}>
            BX Reservations
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Organizations</h1>
        </div>
        <button
          onClick={() => setSlideOpen(true)}
          style={{ background: "var(--bx-brass)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Organization
        </button>
      </div>

      <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)" }}>
        <input
          type="search"
          placeholder="Search organizations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: "var(--bx-ink-soft)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)", borderRadius: 8, padding: "8px 14px", fontSize: 14, color: "var(--bx-parchment)", width: 260, outline: "none" }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {TIERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTierFilter(t.value)}
              style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", border: tierFilter === t.value ? "2px solid var(--bx-brass)" : "2px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)", background: tierFilter === t.value ? "color-mix(in srgb, var(--bx-brass) 12%, transparent)" : "transparent", color: tierFilter === t.value ? "var(--bx-brass)" : "var(--bx-slate)", transition: "all 0.15s" }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--bx-slate)" }}>
          {filtered.length} {filtered.length === 1 ? "org" : "orgs"}
        </span>
      </div>

      {fetchError && (
        <div style={{ margin: "16px 32px", padding: "12px 16px", background: "color-mix(in srgb, var(--bx-clay) 10%, transparent)", border: "1px solid var(--bx-clay)", borderRadius: 8, color: "var(--bx-clay)", fontSize: 14 }}>
          Error loading organizations: {fetchError}
        </div>
      )}

      <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "var(--bx-slate)" }}>
            {search || tierFilter ? "No organizations match your filters." : "No organizations yet. Create one to get started."}
          </div>
        ) : (
          filtered.map((org) => <OrgCard key={org.id} org={org} />)
        )}
      </div>

      {slideOpen && (
        <BodyPortal>
          <div onClick={() => { setSlideOpen(false); setForm(EMPTY_FORM); setFormError(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
          <div className="bx-glass-strong" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", zIndex: 50, display: "flex", flexDirection: "column", borderRadius: 0, borderWidth: "0 0 0 1px", boxShadow: "-12px 0 48px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--bx-parchment)" }}>New Organization</h2>
              <button onClick={() => { setSlideOpen(false); setForm(EMPTY_FORM); setFormError(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--bx-slate)", fontSize: 22, lineHeight: 1, padding: 4 }} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleCreate} style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
              {formError && (
                <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--bx-clay) 10%, transparent)", border: "1px solid var(--bx-clay)", borderRadius: 8, color: "var(--bx-clay)", fontSize: 13 }}>{formError}</div>
              )}
              <Field label="Organization Name *">
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Brainerd Christian School" />
              </Field>
              <Field label="Tier">
                <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as NewOrgForm["tier"] }))}>
                  <option value="external">External</option>
                  <option value="internal">Internal (BBC Ministry)</option>
                  <option value="bbs">BBS</option>
                </select>
              </Field>
              <Field label="Primary Contact Name">
                <input value={form.primary_contact_name} onChange={(e) => setForm((f) => ({ ...f, primary_contact_name: e.target.value }))} placeholder="Jane Smith" />
              </Field>
              <Field label="Contact Email">
                <input type="email" value={form.primary_contact_email} onChange={(e) => setForm((f) => ({ ...f, primary_contact_email: e.target.value }))} placeholder="jane@example.org" />
              </Field>
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(423) 555-0100" />
              </Field>
              <Field label="Address">
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St, Chattanooga, TN" />
              </Field>
              <Field label="Notes">
                <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this organization…" />
              </Field>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={isPending} style={{ flex: 1, background: isPending ? "var(--bx-slate)" : "var(--bx-brass)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 600, fontSize: 15, cursor: isPending ? "not-allowed" : "pointer" }}>
                  {isPending ? "Creating…" : "Create Organization"}
                </button>
                <button type="button" onClick={() => { setSlideOpen(false); setForm(EMPTY_FORM); setFormError(null); }} style={{ background: "transparent", border: "1px solid color-mix(in srgb, var(--bx-parchment) 20%, transparent)", borderRadius: 8, padding: "11px 20px", fontWeight: 600, fontSize: 15, cursor: "pointer", color: "var(--bx-slate)" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </BodyPortal>
      )}
    </div>
  );
}

function OrgCard({ org }: { org: OrgSummary }) {
  const tier = TIER_STYLES[org.tier] ?? TIER_STYLES.external;
  return (
    <Link href={`/admin/bx-reservations/organizations/${org.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="bx-glass-flat"
        style={{ borderRadius: 12, padding: "20px 22px", cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s", display: "flex", flexDirection: "column", gap: 10 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "inset 0 1px 0 var(--bx-highlight), var(--shadow-3)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--bx-brass)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = ""; (e.currentTarget as HTMLDivElement).style.borderColor = ""; }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--bx-parchment)", lineHeight: 1.3 }}>{org.name}</span>
          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: tier.bg, color: tier.text }}>{tier.label}</span>
        </div>
        {org.primary_contact_name && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--bx-slate)" }}>
            {org.primary_contact_name}{org.primary_contact_email && <> · {org.primary_contact_email}</>}
          </p>
        )}
        <div style={{ display: "flex", gap: 16, marginTop: 4, paddingTop: 10, borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)" }}>
          <Stat label="Users" value={org.user_count} />
          <Stat label="Bookings" value={org.reservation_count} />
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--bx-parchment)" }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--bx-slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <style>{`
        .bx-field input, .bx-field select, .bx-field textarea {
          width: 100%; background: var(--bx-ink); border: 1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent);
          border-radius: 8px; padding: 9px 12px; font-size: 14px; color: var(--bx-parchment);
          outline: none; font-family: inherit; box-sizing: border-box;
        }
        .bx-field input:focus, .bx-field select:focus, .bx-field textarea:focus { border-color: var(--bx-brass); }
        .bx-field textarea { resize: vertical; }
      `}</style>
      <div className="bx-field">{children}</div>
    </div>
  );
}
