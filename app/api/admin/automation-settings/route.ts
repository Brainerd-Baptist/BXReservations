import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserAndRole } from "@/lib/get-user-role";
import { isStaffRole } from "@/lib/event-map";

/** 401/403 unless the signed-in user holds a staff role. */
async function requireStaff(): Promise<NextResponse | null> {
  const { user, role } = await getUserAndRole();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaffRole(role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  return null;
}

const ALLOWED_KEYS = [
  "user_reminder_1_days",
  "user_reminder_2_days",
  "auto_cancel_days",
  "admin_reminder_days",
  "coi_expiry_warning_days",
];

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/automation-settings
export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  const sb = adminSb();
  const { data, error } = await sb
    .from("bx_settings")
    .select("key, value, description")
    .in("key", ALLOWED_KEYS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ settings });
}

// PATCH /api/admin/automation-settings
export async function PATCH(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  const body = await req.json();
  const settings: Record<string, string> = body.settings ?? {};

  const sb = adminSb();
  const errors: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 365) {
      errors.push(`Invalid value for ${key}: must be 1–365`);
      continue;
    }
    const { error } = await sb
      .from("bx_settings")
      .upsert({ key, value: String(num) }, { onConflict: "key" });
    if (error) errors.push(`${key}: ${error.message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
