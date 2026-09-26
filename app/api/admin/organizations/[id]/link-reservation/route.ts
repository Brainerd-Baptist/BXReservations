import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST body: { reservation_id: string, unlink?: boolean }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const sb = adminSb();
  const { reservation_id, unlink } = await req.json();

  if (!reservation_id) {
    return NextResponse.json({ error: "reservation_id required" }, { status: 400 });
  }

  const { error } = await sb
    .from("reservations")
    .update({ organization_id: unlink ? null : orgId })
    .eq("id", reservation_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
