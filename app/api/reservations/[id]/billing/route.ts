import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { getBilling, money, requesterCanEditAddons, type ChargeKind } from "@/lib/billing";
import { readVenue } from "@/lib/venue";
import { readWaived } from "@/lib/waivers";

type Params = { params: Promise<{ id: string }> };
const KINDS: ChargeKind[] = ["rental", "addon", "fee", "discount"];

async function context(id: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const db = adminClient();
  const ctx = await getEventMapContext(db, user, id);
  if (!ctx) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const { data: prof } = await db.from("bx_user_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  const actorName = (prof?.display_name as string | undefined) ?? user.email ?? "Someone";
  return { user, db, ctx, actorName } as const;
}

// GET — line items, payments and balance for anyone who can see the booking
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await context(id);
  if ("error" in c) return c.error;
  const [billing, venue, { data: w }] = await Promise.all([
    getBilling(c.db, c.ctx.reservation.id, c.ctx.staff),
    readVenue(c.db),
    c.db.from("reservations").select("waived").eq("id", c.ctx.reservation.id).maybeSingle(),
  ]);
  return NextResponse.json({
    ...billing,
    // How to pay, from Admin → Settings (C3); none when payment isn't needed
    howToPay: readWaived(w?.waived).payment ? null : venue.venue_payment,
    paymentWaived: readWaived(w?.waived).payment,
    staff: c.ctx.staff,
    canAddAddons: c.ctx.staff || (c.ctx.access === "edit" && requesterCanEditAddons(c.ctx.reservation.status)),
    userId: c.user.id,
  });
}

// POST — add a line. Staff: any kind. Requester (organizer/co-organizer):
// catalog add-ons only, at catalog price, while the booking is open.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await context(id);
  if ("error" in c) return c.error;
  const { db, ctx, user } = c;
  const body = await req.json().catch(() => ({})) as {
    kind?: ChargeKind; addon_id?: string; label?: string; unit_price?: number; quantity?: number; note?: string;
  };
  const quantity = money(body.quantity ?? 1);
  if (quantity <= 0) return NextResponse.json({ error: "Quantity must be more than zero." }, { status: 400 });

  let row: Record<string, unknown>;
  if (body.addon_id) {
    if (!ctx.staff && !(ctx.access === "edit" && requesterCanEditAddons(ctx.reservation.status))) {
      return NextResponse.json({ error: "Add-ons can't be changed on this booking any more — message the BX team." }, { status: 403 });
    }
    const { data: addon } = await db.from("bx_addons").select("id, name, price, active").eq("id", body.addon_id).maybeSingle();
    if (!addon || (!addon.active && !ctx.staff)) return NextResponse.json({ error: "That add-on isn't available." }, { status: 400 });
    row = {
      kind: "addon", addon_id: addon.id, label: addon.name,
      unit_price: ctx.staff && body.unit_price !== undefined ? money(body.unit_price) : money(addon.price),
      quantity,
    };
  } else {
    if (!ctx.staff) return NextResponse.json({ error: "Only the BX team can add that." }, { status: 403 });
    const kind = body.kind && KINDS.includes(body.kind) ? body.kind : "fee";
    const label = (body.label ?? "").trim();
    if (!label) return NextResponse.json({ error: "Give the line a description." }, { status: 400 });
    let unit = money(body.unit_price);
    if (!Number.isFinite(unit) || unit === 0) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    if (kind === "discount") unit = -Math.abs(unit);   // discounts always reduce the total
    else if (unit < 0) return NextResponse.json({ error: "Use a Discount line for money off." }, { status: 400 });
    row = { kind, label: label.slice(0, 120), unit_price: unit, quantity };
  }

  const { error } = await db.from("reservation_charges").insert({
    ...row,
    reservation_id: ctx.reservation.id,
    note: (body.note ?? "").trim().slice(0, 300) || null,
    added_by: user.id,
    added_by_staff: ctx.staff,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("reservation_history").insert({
    reservation_id: ctx.reservation.id, actor_id: user.id, actor_name: c.actorName, actor_role: ctx.staff ? "admin" : "user",
    action: "charge_added", note: `${row.label} × ${quantity} added.`,
  });
  return NextResponse.json(await getBilling(db, ctx.reservation.id, ctx.staff), { status: 201 });
}

// DELETE ?chargeId= — staff: any line; requester: their own add-ons while open
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await context(id);
  if ("error" in c) return c.error;
  const { db, ctx, user } = c;
  const chargeId = req.nextUrl.searchParams.get("chargeId");
  if (!chargeId) return NextResponse.json({ error: "chargeId required" }, { status: 400 });
  const { data: charge } = await db.from("reservation_charges").select("*").eq("id", chargeId).eq("reservation_id", ctx.reservation.id).maybeSingle();
  if (!charge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const own = charge.kind === "addon" && !charge.added_by_staff && charge.added_by === user.id;
  if (!ctx.staff && !(own && ctx.access === "edit" && requesterCanEditAddons(ctx.reservation.status))) {
    return NextResponse.json({ error: "Only the BX team can remove that." }, { status: 403 });
  }
  const { error } = await db.from("reservation_charges").delete().eq("id", chargeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("reservation_history").insert({
    reservation_id: ctx.reservation.id, actor_id: user.id, actor_name: c.actorName, actor_role: ctx.staff ? "admin" : "user",
    action: "charge_removed", note: `${charge.label} removed.`,
  });
  return NextResponse.json(await getBilling(db, ctx.reservation.id, ctx.staff));
}
