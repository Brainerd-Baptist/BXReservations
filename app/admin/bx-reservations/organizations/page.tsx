import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";
import { createClient } from "@/lib/supabase/server";
import OrganizationsClient from "./organizations-client";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface OrgSummary {
  id: string;
  name: string;
  canonical_name: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  phone: string | null;
  address: string | null;
  tier: "internal" | "bbs" | "external";
  notes: string | null;
  created_at: string;
  user_count: number;
  reservation_count: number;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default async function OrganizationsPage() {
  const { user, role } = await getUserAndRole();
  if (!user) redirect("/login");
  if (role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: rawOrgs, error } = await supabase
    .from("bx_organizations")
    .select(
      `id, name, canonical_name, primary_contact_name, primary_contact_email,
       phone, address, tier, notes, created_at,
       bx_org_users(user_id),
       reservations!organization_id(id)`
    )
    .order("name");

  const organizations: OrgSummary[] = (rawOrgs ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    canonical_name: o.canonical_name,
    primary_contact_name: o.primary_contact_name,
    primary_contact_email: o.primary_contact_email,
    phone: o.phone,
    address: o.address,
    tier: (o.tier ?? "external") as "internal" | "bbs" | "external",
    notes: o.notes,
    created_at: o.created_at,
    user_count: (o.bx_org_users as unknown[])?.length ?? 0,
    reservation_count: (o.reservations as unknown[])?.length ?? 0,
  }));

  if (error) {
    console.error("orgs fetch error", error);
  }

  return (
    <OrganizationsClient
      initialOrganizations={organizations}
      fetchError={error?.message ?? null}
    />
  );
}
