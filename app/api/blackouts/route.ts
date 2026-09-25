import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface BlackoutRule {
  id: string;
  rule_type: "dow" | "dow_slot" | "date";
  data: Record<string, unknown>;
  label: string;
  active: boolean;
}

function fallbackRules(): BlackoutRule[] {
  return [
    { id: "fb-sun",  rule_type: "dow",      data: { dow: 0 },                    label: "Sundays",           active: true },
    { id: "fb-sat",  rule_type: "dow",      data: { dow: 6 },                    label: "Saturdays",         active: true },
    { id: "fb-wed",  rule_type: "dow_slot", data: { dow: 3, slot: "evening" },   label: "Wednesday evenings", active: true },
  ];
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json(fallbackRules(), {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("blackout_rules")
    .select("id, rule_type, data, label, active")
    .eq("active", true)
    .order("created_at");

  if (error) {
    console.error("[blackouts] Supabase error:", error);
    return NextResponse.json(fallbackRules(), {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }

  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = await req.json() as Partial<BlackoutRule>;
  if (!body.rule_type || !body.data) {
    return NextResponse.json({ error: "rule_type and data required" }, { status: 400 });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("blackout_rules")
    .insert({ rule_type: body.rule_type, data: body.data, label: body.label ?? "" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createClient(url, key);
  const { error } = await supabase.from("blackout_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
