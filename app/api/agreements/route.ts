// app/api/agreements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateToken, buildAgreementText, AgreementRecord } from "@/lib/agreements";
import { createClient } from "@supabase/supabase-js";

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const memStore: Map<string, AgreementRecord> = new Map();

// POST — staff creates agreement
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    reservation_id: string;
    reservation_summary: string;
    contact_name: string;
  };
  const { reservation_id, reservation_summary, contact_name } = body;
  if (!reservation_id || !reservation_summary || !contact_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const token = generateToken();
  const agreement_text = buildAgreementText(reservation_summary, contact_name);
  const record = { reservation_id, token, agreement_text, customer_name: null, customer_signed_at: null, customer_ip: null, staff_name: null, staff_signed_at: null };
  const svc = serviceClient();
  if (svc) {
    const { data, error } = await svc.from("reservation_agreements").insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ token, agreement: data });
  }
  const full: AgreementRecord = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...record };
  memStore.set(token, full);
  return NextResponse.json({ token, agreement: full });
}

// GET — fetch by token or reservation_id
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const reservationId = req.nextUrl.searchParams.get("reservation_id");
  if (token) {
    const anon = anonClient();
    if (anon) {
      const { data, error } = await anon.from("reservation_agreements").select("*").eq("token", token).single();
      if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(data);
    }
    const rec = memStore.get(token);
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rec);
  }
  if (reservationId) {
    const svc = serviceClient();
    if (svc) {
      const { data, error } = await svc.from("reservation_agreements").select("*").eq("reservation_id", reservationId).order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data ?? []);
    }
    const results = Array.from(memStore.values()).filter((r) => r.reservation_id === reservationId);
    return NextResponse.json(results);
  }
  return NextResponse.json({ error: "Provide token or reservation_id" }, { status: 400 });
}

// PATCH — customer signs
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { token: string; customer_name: string };
  const { token, customer_name } = body;
  if (!token || !customer_name?.trim()) return NextResponse.json({ error: "token and customer_name required" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const anon = anonClient();
  if (anon) {
    const { data, error } = await anon.from("reservation_agreements").update({ customer_name: customer_name.trim(), customer_signed_at: new Date().toISOString(), customer_ip: ip }).eq("token", token).is("customer_signed_at", null).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  const rec = memStore.get(token);
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rec.customer_signed_at) return NextResponse.json({ error: "Already signed" }, { status: 409 });
  rec.customer_name = customer_name.trim();
  rec.customer_signed_at = new Date().toISOString();
  rec.customer_ip = ip;
  return NextResponse.json(rec);
}

// PUT — staff countersigns
export async function PUT(req: NextRequest) {
  const body = await req.json() as { token: string; staff_name: string };
  const { token, staff_name } = body;
  if (!token || !staff_name?.trim()) return NextResponse.json({ error: "token and staff_name required" }, { status: 400 });
  const svc = serviceClient();
  if (svc) {
    const { data: existing } = await svc.from("reservation_agreements").select("customer_signed_at").eq("token", token).single();
    if (!existing?.customer_signed_at) return NextResponse.json({ error: "Customer has not signed yet" }, { status: 409 });
    const { data, error } = await svc.from("reservation_agreements").update({ staff_name: staff_name.trim(), staff_signed_at: new Date().toISOString() }).eq("token", token).is("staff_signed_at", null).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  const rec = memStore.get(token);
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rec.customer_signed_at) return NextResponse.json({ error: "Customer has not signed yet" }, { status: 409 });
  rec.staff_name = staff_name.trim();
  rec.staff_signed_at = new Date().toISOString();
  return NextResponse.json(rec);
}
