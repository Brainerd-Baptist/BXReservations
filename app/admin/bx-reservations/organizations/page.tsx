import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";
import { createServerClient } from "@supabase/ssr";
import OrganizationsClient from "./organizations-client";
import OrgFlagQueue, { type OrgFlag } from "./org-flag-queue";

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
  if (!can.viewAdminPanel(role)) redirect("/account");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // Fetch orgs + flags in parallel
  const [orgsResult, flagsResult] = await Promise.all([
    supabase
      .from("bx_organizations")
      .select(
        `id, name, canonical_name, primary_contact_name, primary_contact_email,
         phone, address, tier, notes, created_at,
         bx_org_users(user_id),
         reservations!organization_id(id)`
      )
      .order("name"),
    supabase
      .from("bx_org_flags")
      .select(`
        id, created_at, raw_text, flag_type, confidence, candidates,
        resolved_at, resolution, reservation_id,
        reservations!reservation_id (
          id, booking_number, contact_name, event_name, status
        ),
        suggested_org_id,
        bx_organizations!suggested_org_id (
          id, name, tier, status
        )
      `)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const organizations: OrgSummary[] = (orgsResult.data ?? []).map((o) => ({
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

  const flags = (flagsResult.data ?? []) as unknown as OrgFlag[];

  if (orgsResult.error) {
    console.error("orgs fetch error", orgsResult.error);
  }

  return (
    <>
      <OrganizationsClient
        initialOrganizations={organizations}
        fetchError={orgsResult.error?.message ?? null}
      />
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 16px 64px",
        }}
      >
        <OrgFlagQueue initialFlags={flags} />
      </div>
    </>
  );
}
