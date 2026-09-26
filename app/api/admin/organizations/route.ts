import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── GET — list all organizations ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sb = adminSb();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  // Fetch orgs with reservation counts
  const { data: orgs, error } = await sb
    .from("bx_organizations")
    .select("*")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get reservation stats per org
  const { data: stats } = await sb
    .from("reservations")
    .select("organization_id, id, created_at, status, contact_name, booking_number, coi_expiry_date, coi_accepted_at")
    .not("organization_id", "is", null);

  const statsByOrg: Record<string, {
    count: number;
    latest: string | null;
    hasCoi: boolean;
    coiExpiry: string | null;
  }> = {};

  for (const r of stats ?? []) {
    const oid = r.organization_id as string;
    if (!statsByOrg[oid]) {
      statsByOrg[oid] = { count: 0, latest: null, hasCoi: false, coiExpiry: null };
    }
    statsByOrg[oid].count++;
    if (!statsByOrg[oid].latest || r.created_at > statsByOrg[oid].latest!) {
      statsByOrg[oid].latest = r.created_at;
    }
    if (r.coi_accepted_at && r.coi_expiry_date) {
      statsByOrg[oid].hasCoi = true;
      statsByOrg[oid].coiExpiry = r.coi_expiry_date;
    }
  }

  let result = (orgs ?? []).map((o) => ({
    ...o,
    reservation_count: statsByOrg[o.id]?.count ?? 0,
    latest_reservation_at: statsByOrg[o.id]?.latest ?? null,
    has_coi: statsByOrg[o.id]?.hasCoi ?? false,
    coi_expiry_date: statsByOrg[o.id]?.coiExpiry ?? null,
  }));

  if (q) {
    const ql = q.toLowerCase();
    result = result.filter(
      (o) =>
        o.name.toLowerCase().includes(ql) ||
        (o.primary_contact_name ?? "").toLowerCase().includes(ql) ||
        (o.primary_contact_email ?? "").toLowerCase().includes(ql),
    );
  }

  return NextResponse.json({ organizations: result });
}

// ─── POST — create a new organization ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const sb = adminSb();
  const body = await req.json();

  const { name, canonical_name, primary_contact_name, primary_contact_email, phone, notes } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("bx_organizations")
    .insert({
      name: name.trim(),
      canonical_name: canonical_name ?? name.trim().toLowerCase().replace(/\s+/g, " "),
      primary_contact_name: primary_contact_name ?? null,
      primary_contact_email: primary_contact_email ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ organization: data }, { status: 201 });
}
