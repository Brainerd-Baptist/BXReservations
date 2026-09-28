import { notFound, redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";
import { can, type BxRole } from "@/lib/roles";
import { createServerClient } from "@supabase/ssr";
import UserDetailClient from "./user-detail-client";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface UserAuth {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  organization: string | null;
}

export interface UserReservation {
  id: string;
  booking_number: string | null;
  status: string | null;
  event_name: string | null;
  contact_name: string | null;
  created_at: string;
  rack_rate_total: number | null;
  net_amount: number | null;
}

export interface LinkedOrg {
  org_id: string;
  linked_at: string;
  name: string;
  tier: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function UserDetailPage({
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

  const { data: authUserData, error: authErr } = await db.auth.admin.getUserById(id);
  if (authErr || !authUserData?.user) notFound();

  const [profileResult, roleResult, reservationsResult, orgsResult] = await Promise.all([
    db.from("bx_user_profiles").select("*").eq("user_id", id).maybeSingle(),
    db.from("bx_user_roles").select("role").eq("user_id", id).maybeSingle(),
    db
      .from("reservations")
      .select("id, booking_number, status, event_name, contact_name, created_at, rack_rate_total, net_amount")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    db
      .from("bx_org_users")
      .select("org_id, linked_at, bx_organizations!org_id(id, name, tier)")
      .eq("user_id", id)
      .order("linked_at", { ascending: false }),
  ]);

  const authUser: UserAuth = {
    id: authUserData.user.id,
    email: authUserData.user.email ?? "",
    created_at: authUserData.user.created_at,
    last_sign_in_at: authUserData.user.last_sign_in_at ?? null,
    email_confirmed_at: authUserData.user.email_confirmed_at ?? null,
  };

  const linkedOrgs: LinkedOrg[] = (orgsResult.data ?? []).map((o) => ({
    org_id: o.org_id,
    linked_at: o.linked_at,
    name: (o.bx_organizations as { name?: string } | null)?.name ?? "",
    tier: (o.bx_organizations as { tier?: string } | null)?.tier ?? "external",
  }));

  return (
    <UserDetailClient
      authUser={authUser}
      profile={profileResult.data as UserProfile | null}
      userRole={(roleResult.data?.role as BxRole) ?? null}
      callerRole={role}
      reservations={(reservationsResult.data ?? []) as UserReservation[]}
      linkedOrgs={linkedOrgs}
    />
  );
}
