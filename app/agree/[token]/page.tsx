// app/agree/[token]/page.tsx — Public customer signing page

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AgreementRecord, agreementStatus } from "@/lib/agreements";

export default function AgreePage() {
  const { token } = useParams<{ token: string }>();
  const [agreement, setAgreement] = useState<AgreementRecord | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Signing state
  const [customerName, setCustomerName] = useState("");
  const [agreed, setAgreed]             = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [signed, setSigned]             = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/agreements?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setAgreement(data);
        if (data.customer_signed_at) setSigned(true);
      })
      .catch(() => setError("Failed to load agreement."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !agreed) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/agreements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, customer_name: customerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Failed to submit signature."); return; }
      setAgreement(data);
      setSigned(true);
    } catch {
      setSubmitError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-500 text-sm">Loading agreement…</p>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Agreement not found</p>
          <p className="text-stone-500 text-sm">
            {error ?? "This link may be invalid or expired. Please contact the BX team."}
          </p>
        </div>
      </div>
    );
  }

  const status = agreementStatus(agreement);
  const signedDate = agreement.customer_signed_at
    ? new Date(agreement.customer_signed_at).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-stone-800 mb-1">BX Facility Use Agreement</div>
          <div className="text-stone-500 text-sm">Brainerd Crossing · Brainerd Baptist Church</div>
        </div>

        {/* Agreement text */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700 leading-relaxed">
            {agreement.agreement_text}
          </pre>
        </div>

        {/* Already signed */}
        {signed ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-green-700 font-semibold text-lg mb-1">✓ Agreement Signed</div>
            {signedDate && (
              <p className="text-green-600 text-sm mb-2">
                Signed by <strong>{agreement.customer_name}</strong> on {signedDate}
              </p>
            )}
            {status === "pending_staff" && (
              <p className="text-stone-500 text-sm mt-3">
                The BX team will countersign shortly. Both parties will receive a copy once the agreement is complete.
              </p>
            )}
            {status === "complete" && (
              <p className="text-stone-500 text-sm mt-3">
                ✓ Countersigned by BX staff — your agreement is fully executed.
              </p>
            )}
          </div>
        ) : (
          /* Signing form */
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-stone-800 mb-4">Sign this agreement</h2>
            <form onSubmit={handleSign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Type your full legal name"
                  required
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <p className="text-stone-400 text-xs mt-1">
                  Typing your name serves as your electronic signature.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300"
                />
                <span className="text-sm text-stone-700">
                  I have read and agree to the terms of this Facility Use Agreement, and I understand
                  that this electronic signature is legally binding.
                </span>
              </label>

              {submitError && (
                <p className="text-red-600 text-sm">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={!customerName.trim() || !agreed || submitting}
                className="w-full bg-stone-800 text-white rounded-lg py-2.5 text-sm font-medium
                           disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-700 transition-colors"
              >
                {submitting ? "Submitting…" : "Sign Agreement"}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-stone-400 text-xs mt-6">
          Questions? Contact the BX team at{" "}
          <a href="mailto:bx@brainerdbaptist.org" className="underline">
            bx@brainerdbaptist.org
          </a>
        </p>

      </div>
    </div>
  );
}
