import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";
import { syncLegacyPayment } from "@/lib/billing";
import { stripe } from "@/lib/stripe";
import { buildReadiness } from "@/lib/event-prep-reminders";
import { sendPaymentReceiptEmail, sendAdminPaymentAlert } from "@/lib/email";
import type Stripe from "stripe";

// Next.js must NOT parse the body — Stripe needs the raw bytes to verify the signature.
export const runtime = "nodejs";

/**
 * POST — Stripe webhook endpoint.
 *
 * Set up in the Stripe dashboard (or CLI) with these events:
 *   payment_intent.succeeded
 *
 * Add STRIPE_WEBHOOK_SECRET to Vercel env vars from the webhook signing secret
 * shown in the Stripe dashboard after creating the endpoint.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await handlePaymentSucceeded(pi);
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const reservationId = pi.metadata?.reservation_id;
  if (!reservationId) {
    console.warn("[stripe/webhook] payment_intent.succeeded missing reservation_id in metadata", pi.id);
    return;
  }

  // Dollar amount — Stripe stores cents.
  const amount = pi.amount_received / 100;
  const db = adminClient();

  // Confirm the reservation exists (with all fields needed for readiness + emails).
  const { data: res } = await db
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, status, payload, coi_accepted_at, coi_uploaded_at, waived")
    .eq("id", reservationId)
    .maybeSingle();
  if (!res) {
    console.error("[stripe/webhook] Reservation not found:", reservationId);
    return;
  }

  // Guard against duplicate webhook deliveries.
  const { data: existing } = await db
    .from("reservation_payments")
    .select("id")
    .eq("reservation_id", reservationId)
    .eq("note", `Stripe PI ${pi.id}`)
    .maybeSingle();
  if (existing) {
    console.log("[stripe/webhook] Duplicate PI, skipping:", pi.id);
    return;
  }

  const receivedAt = pi.created
    ? new Date(pi.created * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const { error } = await db.from("reservation_payments").insert({
    reservation_id: res.id,
    amount,
    method: "Card (online)",
    received_at: receivedAt,
    note: `Stripe PI ${pi.id}`,
    recorded_by: null,
    recorded_by_name: "Online payment",
  });

  if (error) {
    console.error("[stripe/webhook] Failed to insert payment:", error.message);
    return;
  }

  await syncLegacyPayment(db, res.id);

  await db.from("reservation_history").insert({
    reservation_id: res.id,
    actor_id: null,
    actor_name: "Stripe",
    actor_role: "system",
    action: "payment_recorded",
    note: `Online payment of $${amount.toFixed(2)} received via Stripe.`,
    metadata: {
      payment_amount: amount,
      payment_method: "Card (online)",
      stripe_payment_intent_id: pi.id,
    },
  });

  console.log(`[stripe/webhook] Recorded $${amount.toFixed(2)} for reservation ${res.id}`);

  // ── Notification emails ──────────────────────────────────────────────────
  try {
    const readiness = await buildReadiness(db, res as Parameters<typeof buildReadiness>[1]);
    if (readiness) {
      // Override amountPaid with the actual payment received.
      const r = { ...readiness, amountPaid: amount };

      // 1. Renter receipt — always.
      await sendPaymentReceiptEmail(r).catch(e =>
        console.error("[stripe/webhook] sendPaymentReceiptEmail failed:", e)
      );

      // 2. Admin alert — gated on the payment_alerts_enabled setting (default: on).
      const { data: alertSetting } = await db
        .from("bx_settings")
        .select("value")
        .eq("key", "payment_alerts_enabled")
        .maybeSingle();
      const alertsEnabled = (alertSetting as { value?: string } | null)?.value !== "false";

      if (alertsEnabled) {
        await sendAdminPaymentAlert(r).catch(e =>
          console.error("[stripe/webhook] sendAdminPaymentAlert failed:", e)
        );
      } else {
        console.log("[stripe/webhook] Admin payment alerts disabled — skipping admin alert.");
      }
    }
  } catch (e) {
    // Email failure should never fail the webhook — Stripe would retry.
    console.error("[stripe/webhook] Email notification failed:", e);
  }
}
