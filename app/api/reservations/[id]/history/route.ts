import { NextResponse } from "next/server";
import { getEventMapContext } from "@/lib/event-map";
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

  // Staff, the requester (account or booking email) or an accepted collaborator
  const ctx = await getEventMapContext(supabase, user, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: history, error } = await supabase
    .from("reservation_history")
    .select("id, actor_name, actor_role, action, from_status, to_status, note, created_at")
    .eq("reservation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(history ?? []);
}
