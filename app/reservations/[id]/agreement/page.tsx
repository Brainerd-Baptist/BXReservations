import { notFound } from "next/navigation";
import { adminClient } from "@/lib/event-map";
import AgreementSignForm from "./AgreementSignForm";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> };

export default async function AgreementPage({ params, searchParams }: Props) {
  const { id }    = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bx-ink)", color: "var(--bx-parchment)", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Invalid Link</h1>
          <p style={{ color: "var(--bx-slate)" }}>This agreement link is invalid or has expired. Please contact the BX team.</p>
        </div>
      </main>
    );
  }

  // Load reservation
  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_org, contact_email, payload")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();

  if (!res) notFound();

  // Load agreement by token
  const { data: agreement } = await adminClient()
    .from("reservation_agreements")
    .select("id, token, agreement_text, customer_signed_at, customer_name")
    .eq("reservation_id", res.id)
    .eq("token", token)
    .maybeSingle();

  if (!agreement) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bx-ink)", color: "var(--bx-parchment)", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Link Not Found</h1>
          <p style={{ color: "var(--bx-slate)" }}>This agreement link is invalid or has expired. Please contact the BX team for a new link.</p>
        </div>
      </main>
    );
  }

  const alreadySigned = !!agreement.customer_signed_at;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bx-ink)", color: "var(--bx-parchment)", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            
            <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bx-brass)" }}>Brainerd Baptist · BX Reservations</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Facility Use Agreement</h1>
          <p style={{ margin: "0.4rem 0 0", color: "var(--bx-slate)", fontSize: "0.9rem" }}>
            Reservation {res.booking_number ?? res.id.slice(0, 8)} — {res.event_name}
          </p>
        </div>

        {alreadySigned ? (
          <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 10, padding: "1.25rem 1.5rem", color: "#065F46" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>✓ Agreement already signed</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
              Signed by <strong>{agreement.customer_name}</strong> on{" "}
              {new Date(agreement.customer_signed_at!).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/New_York" })}.
              No further action needed.
            </p>
          </div>
        ) : (
          <>
            {/* Agreement text */}
            <div style={{
              background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)",
              border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)",
              borderRadius: 10, padding: "1.5rem", marginBottom: "2rem",
              maxHeight: 480, overflowY: "auto", fontSize: "0.875rem", lineHeight: 1.7,
              color: "var(--bx-slate)", whiteSpace: "pre-wrap", fontFamily: "monospace",
            }}>
              {agreement.agreement_text}
            </div>

            <AgreementSignForm
              reservationId={res.id as string}
              agreementId={agreement.id as string}
              token={token}
              contactName={res.contact_name as string}
            />
          </>
        )}
      </div>
    </main>
  );
}
