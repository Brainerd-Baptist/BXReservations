import Stripe from "stripe";

// Server-only — never import this in a "use client" file.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-10-28.endive",
});
