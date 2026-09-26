import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleData } = await supabase
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role ?? "member";
  const isAdmin = ["owner", "system_admin", "booking_admin"].includes(role);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("bx_ministries")
    .select("id, name, description, created_at")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ministries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleData } = await supabase
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role ?? "member";
  const isAdmin = ["owner", "system_admin", "booking_admin"].includes(role);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ error: "Service client unavailable" }, { status: 503 });
  }

  const { data, error } = await svc
    .from("bx_ministries")
    .insert({ name: name.trim(), description: description?.trim() ?? null })
    .select("id, name, description, created_at")
    .single();

  if (error) {
    console.error("[bx/ministries] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ministry: data });
}
