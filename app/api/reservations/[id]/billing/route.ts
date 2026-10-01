import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { getBilling, money, requesterCanEditAddons, type ChargeKind } from "@/lib/billing";
import { readVenue } from "@/lib/venue";
import { readWaived } from "@/lib/waivers";
import { releaseReward, syncRewardDiscount } from "@/lib/survey";
import { addAddons, ESTIMATE_STATUSES, isAutoRental, syncRoomCharges } from "@/lib/room-prices";
import { currentQuote, quoteState } from "@/lib/quotes";

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
  const [billing, venue, { data: w }, quote] = await Promise.all([
    getBilling(c.db, c.ctx.reservation.id, c.ctx.staff),
    readVenue(c.db),
    c.db.from("reservations").select("waived, status, rental_manual").eq("id", c.ctx.reservation.id).maybeSingle(),
    currentQuote(c.db, c.ctx.reservation.id).catch(() => null),
  ]);
  // The approval link is for staff and the organizer / co-organizers, not viewers
  const qs = quote ? quoteState(quote, billing.charges) : null;
  return NextResponse.json({
    ...billing,
    // How to pay, from Admin → Settings (C3); none when payment isn't needed
    howToPay: readWaived(w?.waived).payment ? null : venue.venue_payment,
    paymentWaived: readWaived(w?.waived).payment,
    // Room charges are still the estimate from the booking page until staff approve
    estimate: ESTIMATE_STATUSES.has(String(w?.status ?? "")),
    rentalManual: !!w?.rental_manual,
    quote: qs && (c.ctx.access === "edit") ? qs : qs ? { ...qs, token: null } : null,
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
    kind?: ChargeKind; addon_id?: string; label?: string; unit_price?: number; quantity?: number; note?: string; recalculate?: boolean;
  };

  // Staff: rebuild the room lines from the schedule and the current price list
  if (body.recalculate === true) {
    if (!ctx.staff) return NextResponse.json({ error: "Only the BX team can do that." }, { status: 403 });
    const res = await syncRoomCharges(db, ctx.reservation.id, { force: true, actorId: user.id });
    await db.from("reservation_history").insert({
      reservation_id: ctx.reservation.id, actor_id: user.id, actor_name: c.actorName, actor_role: "admin",
      action: "charge_added", note: res.updated ? "Room charges recalculated from the schedule." : "Room charges recalculated.",
    });
    return NextResponse.json(await getBilling(db, ctx.reservation.id, ctx.staff));
  }
  const quantity = money(body.quantity ?? 1);
  if (quantity <= 0) return NextResponse.json({ error: "Quantity must be more than zero." }, { status: 400 });

  let row: Record<string, unknown>;
  if (body.addon_id) {
    if (!ctx.staff && !(ctx.access === "edit" && requesterCanEditAddons(ctx.reservation.status))) {
      return NextResponse.json({ error: "Add-ons can't be changed on this booking any more — message the BX team." }, { status: 403 });
    }
    // Catalog price, room rules and hour tiers (Complete AV package → one line per event day)
    let res: { added: string[]; skipped: string[] };
    try {
      res = await addAddons(db, ctx.reservation.id, [{ id: body.addon_id, qty: quantity }], {
        actorId: user.id, staff: ctx.staff, includeHidden: ctx.staff,
        unitPrice: ctx.staff && body.unit_price !== undefined ? money(body.unit_price) : undefined,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    }
    if (res.skipped.length) return NextResponse.json({ error: `${res.skipped[0]} is only available with its room — add that room to the booking first.` }, { status: 400 });
    if (!res.added.length) return NextResponse.json({ error: "That add-on isn't available." }, { status: 400 });
    await db.from("reservation_history").insert({
      reservation_id: ctx.reservation.id, actor_id: user.id, actor_name: c.actorName, actor_role: ctx.staff ? "admin" : "user",
      action: "charge_added", note: `${res.added[0]}${quantity !== 1 ? ` × ${quantity}` : ""} added.`,
    });
    await syncRewardDiscount(db, ctx.reservation.id);
    return NextResponse.json(await getBilling(db, ctx.reservation.id, ctx.staff), { status: 201 });
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

  // Staff typing in a room line → they're pricing rooms by hand; schedule edits leave it alone
  if (row.kind === "rental" && ctx.staff) {
    await db.from("reservations").update({ rental_manual: true }).eq("id", ctx.reservation.id);
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
  await syncRewardDiscount(db, ctx.reservation.id); // keep the survey thank-you at X% of the new total
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
  // Removing the survey thank-you line gives the reward back to the person for a later booking
  if (charge.auto_key === "reward") {
    await releaseReward(db, ctx.reservation.id);
  } else {
    const { error } = await db.from("reservation_charges").delete().eq("id", chargeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Staff removed an automatic room line → they're pricing the rooms by hand now;
    // schedule edits stop rebuilding the lines until someone presses Recalculate
    if (isAutoRental(charge.auto_key)) {
      await db.from("reservations").update({ rental_manual: true }).eq("id", ctx.reservation.id);
    }
    await syncRewardDiscount(db, ctx.reservation.id);
  }
  await db.from("reservation_history").insert({
    reservation_id: ctx.reservation.id, actor_id: user.id, actor_name: c.actorName, actor_role: ctx.staff ? "admin" : "user",
    action: "charge_removed", note: `${charge.label} removed.`,
  });
  return NextResponse.json(await getBilling(db, ctx.reservation.id, ctx.staff));
}
