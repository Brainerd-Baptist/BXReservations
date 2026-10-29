import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { getBilling } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

type Params = { params: Promise<{ id: string }> };

/**
 * POST — create a Stripe Payment Intent for the outstanding balance on a
 * reservation. Returns { clientSecret } for use with Stripe Elements.
 *
 * Auth: the caller must be signed in and have at least "edit" access to
 * the reservation (organizer, co-organizer, or staff).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const db = adminClient();
  const ctx = await getEventMapContext(db, user, id);
  if (!ctx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (ctx.access !== "edit") {
    return NextResponse.json({ error: "Edit access required" }, { status: 403 });
  }

  const billing = await getBilling(db, ctx.reservation.id, ctx.staff);
  const { balance } = billing.totals;

  if (balance <= 0) {
    return NextResponse.json(
      { error: "No balance is owed on this reservation." },
      { status: 400 }
    );
  }

  // Stripe amounts are in cents (integer).
  const amountCents = Math.round(balance * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      reservation_id: ctx.reservation.id,
      booking_number: ctx.reservation.booking_number ?? "",
      event_name: ctx.reservation.event_name ?? "",
    },
    description: `BX Reservation – ${ctx.reservation.booking_number ?? ctx.reservation.id}`,
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
