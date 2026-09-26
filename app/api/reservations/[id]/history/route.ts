import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// GET /api/reservations/[id]/history
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verify access: owner or admin
  const { data: resRow } = await supabase
    .from("reservations")
    .select("user_id, contact_email")
    .eq("id", id)
    .single();

  if (!resRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: roleRow } = await supabase
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = ["admin", "superadmin", "staff"].includes(roleRow?.role ?? "");
  const isOwner =
    resRow.user_id === user.id ||
    (resRow.contact_email ?? "").toLowerCase() === (user.email ?? "").toLowerCase();

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: history, error } = await supabase
    .from("reservation_history")
    .select("id, actor_name, actor_role, action, from_status, to_status, note, created_at")
    .eq("reservation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(history ?? []);
}
