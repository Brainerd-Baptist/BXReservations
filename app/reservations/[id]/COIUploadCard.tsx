"use client";
import { FileText, Paperclip } from "lucide-react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props { reservationId: string }

export default function COIUploadCard({ reservationId }: Props) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [file,   setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,  setError]   = useState<string | null>(null);
  const [done,   setDone]    = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/coi`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      setDone(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ background: "var(--tone-green-bg)", border: "1px solid var(--tone-green-bd)", borderRadius: 10, padding: "1rem 1.25rem", color: "var(--tone-green-fg)" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>✓ COI uploaded successfully</p>
        <p style={{ margin: "0.3rem 0 0", fontSize: "0.875rem" }}>The BX team has been notified and will review your certificate.</p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid color-mix(in srgb, #F97316 30%, transparent)", borderRadius: 10, padding: "1.25rem 1.5rem", background: "color-mix(in srgb, #F97316 5%, transparent)" }}>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9375rem", fontWeight: 700, color: "var(--bx-parchment)" }}>
        Certificate of Insurance Required
      </h3>
      <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--bx-slate)", lineHeight: 1.55 }}>
        Please upload your Certificate of Insurance (COI) to continue. The certificate must:
      </p>
      <ul style={{ margin: "0 0 1.25rem 1.25rem", padding: 0, fontSize: "0.875rem", color: "var(--bx-slate)", lineHeight: 1.7 }}>
        <li>Name <strong style={{ color: "var(--bx-parchment)" }}>Brainerd Baptist Church</strong> as additionally insured</li>
        <li>Show minimum <strong style={{ color: "var(--bx-parchment)" }}>$1,000,000</strong> general liability coverage</li>
        <li>Be valid through your event date(s)</li>
        <li>Be a PDF, JPG, or PNG file (max 20 MB)</li>
      </ul>
      <p style={{ margin: "-0.5rem 0 1.25rem", fontSize: "0.8125rem", color: "var(--bx-slate)", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--bx-parchment)" }}>Where to get one:</strong> ask the insurance agent for your organization (or your home or renter&apos;s insurance) for a
        &ldquo;certificate of insurance for an event.&rdquo; It&apos;s usually free and takes a day or two. Give them the event date and the church&apos;s name above.
      </p>

      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${file ? "var(--tone-green-bd)" : "color-mix(in srgb, var(--bx-parchment) 25%, transparent)"}`,
          borderRadius: 8, padding: "1.5rem", textAlign: "center", cursor: "pointer",
          marginBottom: "1rem", background: "color-mix(in srgb, var(--bx-parchment) 3%, transparent)",
          transition: "border-color 0.15s",
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ display: "none" }} />
        {file ? (
          <>
            <div style={{ marginBottom: "0.35rem", display: "flex", justifyContent: "center" }}><FileText size={28} strokeWidth={1.5} color="var(--bx-parchment)" /></div>
            <div style={{ fontWeight: 600, color: "var(--bx-parchment)", fontSize: "0.875rem" }}>{file.name}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--bx-slate)", marginTop: "0.2rem" }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "0.35rem", display: "flex", justifyContent: "center" }}><Paperclip size={28} strokeWidth={1.5} color="var(--bx-slate)" /></div>
            <div style={{ fontWeight: 600, color: "var(--bx-parchment)", fontSize: "0.875rem" }}>Click to choose file</div>
            <div style={{ fontSize: "0.8rem", color: "var(--bx-slate)", marginTop: "0.2rem" }}>PDF, JPG, or PNG · Max 20 MB</div>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: "var(--tone-red-bg)", border: "1px solid var(--tone-red-bd)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "0.75rem", color: "var(--tone-red-fg)", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        style={{
          background: file && !loading ? "var(--bx-action-bg)" : "color-mix(in srgb, var(--bx-parchment) 10%, transparent)",
          color: file && !loading ? "var(--bx-action-fg)" : "var(--bx-slate)",
          border: "none", borderRadius: 8, padding: "0.75rem 1.5rem",
          fontSize: "0.9rem", fontWeight: 700, cursor: file && !loading ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Uploading…" : "Upload COI"}
      </button>
    </div>
  );
}
