import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient, isStaffRole } from "@/lib/event-map";

// ─── Auth helpers (same pattern as /api/admin/reservations/*) ─────────────────

async function sbServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(ts) {
          try { ts.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

async function requireAdmin(sb: Awaited<ReturnType<typeof sbServer>>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient()
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

// ─── Period bounds ────────────────────────────────────────────────────────────

function periodBounds(
  period: string,
  from?: string,
  to?: string
): { from: string; to: string } {
  const thisYear = new Date().getFullYear();
  if (period === "last_year") {
    return {
      from: `${thisYear - 1}-01-01T00:00:00.000Z`,
      to:   `${thisYear}-01-01T00:00:00.000Z`,
    };
  }
  if (period === "custom" && from && to) {
    return {
      from: `${from}T00:00:00.000Z`,
      to:   `${to}T23:59:59.999Z`,
    };
  }
  // default: this_year
  return {
    from: `${thisYear}-01-01T00:00:00.000Z`,
    to:   `${thisYear + 1}-01-01T00:00:00.000Z`,
  };
}

// ─── GET /api/admin/reports/bx ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sb = await sbServer();
  const admin = await requireAdmin(sb);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const period    = sp.get("period") ?? "this_year";
  const customFrom = sp.get("from") ?? undefined;
  const customTo   = sp.get("to")   ?? undefined;

  const bounds = periodBounds(period, customFrom, customTo);

  const db = adminClient();

  const { data: rows, error } = await db
    .from("reservations")
    .select(`
      id, status, rack_rate_total, discount_applied, net_amount, organization_id,
      bx_organizations!organization_id(id, name, tier)
    `)
    .gte("created_at", bounds.from)
    .lt("created_at", bounds.to)
    .not("status", "in", '("Declined","Cancelled by BX","Cancelled by User","Expired")');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type OrgRef = { id: string; name: string; tier: string } | null;
  type Row = {
    id: string;
    status: string | null;
    rack_rate_total: number | null;
    discount_applied: number | null;
    net_amount: number | null;
    organization_id: string | null;
    bx_organizations: OrgRef;
  };

  const safeRows = (rows ?? []) as Row[];

  // KPI accumulation
  let total = 0;
  let intCount = 0, intRack = 0;
  let bbsCount = 0, bbsRack = 0;
  let extCount = 0, extNet  = 0;
  let discountsGiven = 0;

  // org breakdown map: key = organization_id | "unlinked"
  const orgMap = new Map<string, {
    org_name: string;
    tier: string;
    bookings: number;
    rack_rate: number;
    discount: number;
    net: number;
  }>();

  for (const row of safeRows) {
    total++;
    const org  = row.bx_organizations as OrgRef;
    const tier = org?.tier ?? "external";
    const orgName = org?.name ?? "Unlinked";
    const rack = Number(row.rack_rate_total ?? 0);
    const disc = Number(row.discount_applied ?? 0);
    const net  = Number(row.net_amount ?? 0);

    discountsGiven += disc;

    if (tier === "internal") {
      intCount++;
      intRack += rack;
    } else if (tier === "bbs") {
      bbsCount++;
      bbsRack += rack;
    } else {
      extCount++;
      extNet += net;
    }

    const key = row.organization_id ?? "unlinked";
    const existing = orgMap.get(key);
    if (existing) {
      existing.bookings++;
      existing.rack_rate += rack;
      existing.discount  += disc;
      existing.net       += net;
    } else {
      orgMap.set(key, { org_name: orgName, tier, bookings: 1, rack_rate: rack, discount: disc, net });
    }
  }

  const byOrg = Array.from(orgMap.values()).sort((a, b) => b.bookings - a.bookings);

  return NextResponse.json({
    period: { from: bounds.from, to: bounds.to },
    kpis: {
      total,
      internal:        { count: intCount, rack_rate_total: intRack },
      bbs:             { count: bbsCount, rack_rate_total: bbsRack },
      external:        { count: extCount, net_amount: extNet },
      discounts_given: discountsGiven,
      net_revenue:     extNet,
    },
    by_org: byOrg,
  });
}
