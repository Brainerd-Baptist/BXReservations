import { redirect, notFound } from "next/navigation";
import { can } from "@/lib/roles";
import { getUserAndRole } from "@/lib/get-user-role";
import { createServerClient } from "@supabase/ssr";
import OrgDetailClient from "./org-detail-client";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface OrgDetail {
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
  updated_at: string;
}

export interface LinkedUser {
  user_id: string;
  linked_at: string;
  email: string;
  display_name: string | null;
}

export interface ReservationRow {
  id: string;
  booking_number: string | null;
  status: string | null;
  event_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_org: string | null;
  created_at: string;
  rack_rate_total: number | null;
  discount_applied: number | null;
  net_amount: number | null;
}

export interface DiscountRule {
  id: string;
  type: "percent" | "flat_dollar" | "room_rate_override";
  value: number;
  scope: "all_rooms" | "specific_room";
  room_id: string | null;
  discount_reason: string | null;
  note: string | null;
  created_at: string;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, role } = await getUserAndRole();
  if (!user) redirect("/login");
  if (!can.viewAdminPanel(role)) redirect("/account");

  const { id } = await params;

  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const [orgResult, usersResult, reservationsResult, discountsResult] =
    await Promise.all([
      db.from("bx_organizations").select("*").eq("id", id).single(),

      db
        .from("bx_org_users")
        .select(
          `user_id, linked_at,
           bx_user_profiles!user_id(display_name)`
        )
        .eq("org_id", id)
        .order("linked_at", { ascending: false }),

      db
        .from("reservations")
        .select(
          `id, booking_number, status, event_name, contact_name, contact_email,
           contact_org, created_at, rack_rate_total, discount_applied, net_amount`
        )
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(25),

      db
        .from("bx_discounts")
        .select("id, type, value, scope, room_id, discount_reason, note, created_at")
        .eq("org_id", id)
        .is("reservation_id", null)
        .order("created_at", { ascending: false }),
    ]);

  if (orgResult.error?.code === "PGRST116") notFound();
  if (orgResult.error) {
    throw new Error(orgResult.error.message);
  }

  const userIds = (usersResult.data ?? []).map((u) => u.user_id);
  let emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: authUsers } = await db.auth.admin.listUsers();
    if (authUsers) {
      emailMap = Object.fromEntries(
        authUsers.users
          .filter((u) => userIds.includes(u.id))
          .map((u) => [u.id, u.email ?? ""])
      );
    }
  }

  const linkedUsers: LinkedUser[] = (usersResult.data ?? []).map((u) => ({
    user_id: u.user_id,
    linked_at: u.linked_at,
    email: emailMap[u.user_id] ?? "",
    display_name:
      (u.bx_user_profiles as { display_name?: string } | null)?.display_name ??
      null,
  }));

  return (
    <OrgDetailClient
      org={orgResult.data as OrgDetail}
      linkedUsers={linkedUsers}
      reservations={(reservationsResult.data ?? []) as ReservationRow[]}
      discounts={(discountsResult.data ?? []) as DiscountRule[]}
    />
  );
}
