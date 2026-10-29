"use client";

import { useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "./ui/button";

// Singleton — loadStripe is safe to call at module level.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface Props {
  reservationId: string;
  balance: number;
  onSuccess: () => void;
  onCancel: () => void;
}

/** Outer wrapper — fetches the Payment Intent client secret and mounts Elements. */
export default function PayOnlineForm({
  reservationId,
  balance,
  onSuccess,
  onCancel,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reservations/${reservationId}/pay`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        setClientSecret(data.clientSecret);
      })
      .catch((e: Error) => setFetchError(e.message));
  }, [reservationId]);

  if (fetchError) {
    return (
      <div className="bx-well rounded-xl p-4 space-y-3">
        <p className="text-sm text-red-400">{fetchError}</p>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="bx-well rounded-xl p-4">
        <p className="text-sm text-slate">Preparing payment…</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#7c96b2",
            colorBackground: "#0f1c2e",
            colorText: "#e8dfc8",
            colorDanger: "#f87171",
            fontFamily: "inherit",
            borderRadius: "8px",
          },
        },
      }}
    >
      <PayForm balance={balance} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

/** Inner form — must be rendered inside <Elements>. */
function PayForm({
  balance,
  onSuccess,
  onCancel,
}: {
  balance: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message ?? "Something went wrong.");
      setBusy(false);
      return;
    }

    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Redirect to the same page after 3DS; the page will reload billing.
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message ?? "Payment failed.");
      setBusy(false);
    } else {
      setDone(true);
      onSuccess();
    }
  }

  if (done) {
    return (
      <div className="bx-well rounded-xl p-4 space-y-1">
        <p className="text-sm font-semibold text-parchment">Payment received — thank you!</p>
        <p className="text-xs text-slate">You&apos;ll get a receipt by email shortly.</p>
      </div>
    );
  }

  return (
    <form
      className="bx-well rounded-xl p-4 space-y-4"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate mb-0.5">
          Pay online
        </p>
        <p className="text-sm text-parchment">
          ${balance.toFixed(2)} due · card or ACH bank transfer
        </p>
      </div>

      <PaymentElement />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={!stripe}>
          Pay ${balance.toFixed(2)}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
