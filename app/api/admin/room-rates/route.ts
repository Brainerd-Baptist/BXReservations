import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient, isStaffRole } from "@/lib/event-map";

// ─── Auth (matches /api/admin/reports/bx pattern) ────────────────────────────

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

// ─── GET /api/admin/room-rates ────────────────────────────────────────────────
// Returns the most-recent effective rate for each room (effective_date <= today).

export async function GET() {
  const sb = await sbServer();
  const auth = await requireAdmin(sb);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await db
    .from("bx_room_rates")
    .select("id, room_id, rate_per_hour, effective_date, created_at, created_by")
    .order("room_id")
    .order("effective_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pick the most-recent rate with effective_date <= today per room;
  // fall back to the earliest future rate if nothing is in effect yet.
  const byRoom: Record<string, NonNullable<typeof data>[number]> = {};
  for (const row of data ?? []) {
    const existing = byRoom[row.room_id];
    if (!existing) {
      byRoom[row.room_id] = row;
    } else if (
      row.effective_date <= today &&
      (existing.effective_date > today || row.effective_date > existing.effective_date)
    ) {
      byRoom[row.room_id] = row;
    }
  }

  return NextResponse.json({ rates: byRoom });
}

// ─── PATCH /api/admin/room-rates ──────────────────────────────────────────────
// Body: { room_id: string; rate_per_hour: number; effective_date?: string }
// Upserts a rate; effective_date defaults to today.

export async function PATCH(request: NextRequest) {
  const sb = await sbServer();
  const auth = await requireAdmin(sb);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { room_id, rate_per_hour, effective_date } = body;

  if (!room_id || typeof room_id !== "string") {
    return NextResponse.json({ error: "room_id is required" }, { status: 400 });
  }
  const rate = parseFloat(rate_per_hour);
  if (isNaN(rate) || rate < 0) {
    return NextResponse.json({ error: "rate_per_hour must be a non-negative number" }, { status: 400 });
  }

  const effectiveDate = effective_date ?? new Date().toISOString().slice(0, 10);

  const db = adminClient();
  const { data, error } = await db
    .from("bx_room_rates")
    .upsert(
      {
        room_id,
        rate_per_hour: rate,
        effective_date: effectiveDate,
        created_by: auth.user.id,
      },
      { onConflict: "room_id,effective_date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate: data });
}
