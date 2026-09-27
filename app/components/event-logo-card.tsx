"use client";

// Event logo — upload, preview, review.
// One component, two homes: the reservation page (planner: upload / replace /
// remove; staff also see review controls) and the admin panel (compact).
// The file goes straight from the browser to private storage via a signed
// slot, then the server normalises it and queues it for review.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LogoState } from "@/lib/event-logo-types";
import { LOGO_STATUS } from "@/lib/status-tokens";

const BUCKET = "event-logos";
const ACCEPT = "image/png,image/jpeg,image/svg+xml";
const MAX = 10 * 1024 * 1024;

const STATUS: Record<LogoState["status"], { label: string; bg: string; color: string }> = {
  none: { label: "No logo yet", bg: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)" },
  pending: { label: "Waiting for review", bg: "#FEF3C7", color: "#92400E" },
  approved: { label: "Approved", bg: "#D1FAE5", color: "#065F46" },
  rejected: { label: "Needs a different file", bg: "#FEE2E2", color: "#991B1B" },
};

export default function EventLogoCard({
  reservationId,
  initial,
  canEdit,
  staff,
  compact = false,
}: {
  reservationId: string;
  initial?: LogoState;
  canEdit: boolean;
  staff: boolean;
  compact?: boolean;
}) {
  const [state, setState] = useState<LogoState | null>(initial ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const api = `/api/event-map/${reservationId}/logo`;

  useEffect(() => {
    if (initial) return;
    let live = true;
    fetch(api)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => live && s && setState(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [api, initial]);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (!ACCEPT.split(",").includes(file.type)) return setError("Use a PNG, JPG or SVG.");
      if (file.size > MAX) return setError("Files up to 10 MB.");
      try {
        setBusy("Uploading…");
        const slot = await fetch(api, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mime: file.type, bytes: file.size }),
        });
        if (!slot.ok) throw new Error((await slot.json().catch(() => ({})))?.error ?? "Couldn't start the upload");
        const { path, token } = (await slot.json()) as { path: string; token: string };
        const { error: upErr } = await createClient()
          .storage.from(BUCKET)
          .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: true });
        if (upErr) throw new Error(upErr.message);
        setBusy("Preparing your logo…");
        const done = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, mime: file.type, name: file.name }),
        });
        if (!done.ok) throw new Error((await done.json().catch(() => ({})))?.error ?? "Couldn't save the logo");
        setState(await done.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [api]
  );

  const remove = useCallback(async () => {
    setError(null);
    setBusy("Removing…");
    try {
      const r = await fetch(api, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Couldn't remove the logo");
      setState(await r.json());
      setConfirmRemove(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }, [api]);

  const review = useCallback(
    async (decision: "approve" | "reject") => {
      setError(null);
      setBusy(decision === "approve" ? "Approving…" : "Sending…");
      try {
        const r = await fetch(api, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note: decision === "reject" ? note : undefined }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Couldn't record that");
        setState(await r.json());
        setAsking(false);
        setNote("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    },
    [api, note]
  );

  const s = state ?? { status: "none" as const, meta: null, previewUrl: null, reviewedAt: null };
  const chip = LOGO_STATUS[s.status];
  const has = s.status !== "none";
  const soft = !!s.meta?.soft;
  const pad = compact ? "0.875rem 1rem" : "1.25rem 1.5rem";

  return (
    <section
      id="logo"
      aria-label="Event logo"
      style={{
        border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
        borderRadius: "12px",
        padding: pad,
        marginBottom: compact ? 0 : "1rem",
        background: "var(--bx-ink-soft)",
        color: "var(--bx-parchment)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0, fontSize: compact ? "0.6875rem" : "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bx-slate)" }}>
          Event logo
        </h2>
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 600, background: chip.bg, color: chip.color }}>
          {chip.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "160px 1fr" : "minmax(0, 220px) 1fr", gap: "1rem", alignItems: "start" }}>
        {/* the logo always sits on a white field, the same way it will on the map and the signs */}
        <div
          style={{
            aspectRatio: "16 / 9",
            borderRadius: 10,
            background: "#fff",
            border: has ? "1px solid #e5e7eb" : "1.5px dashed color-mix(in srgb, var(--bx-parchment) 25%, transparent)",
            display: "grid",
            placeItems: "center",
            padding: "10%",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {has && s.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.previewUrl} alt="Event logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="M21 16l-5-5-7 7" />
            </svg>
          )}
        </div>

        <div style={{ minWidth: 0, fontSize: compact ? "0.8125rem" : "0.875rem", lineHeight: 1.5 }}>
          {!compact && (
            <p style={{ margin: "0 0 0.5rem", color: "var(--bx-slate)" }}>
              {has
                ? "It shows in the header of your event map and on every door sign. Replacing it sends the new file through review again."
                : "Add your event or organization logo. It goes in the header of your event map and on your door signs. Our team approves it first — no logo is fine too; signs then use a clean typographic version of your event name."}
            </p>
          )}
          {s.status === "rejected" && s.meta?.review_note && (
            <p style={{ margin: "0 0 0.5rem", padding: "0.5rem 0.75rem", borderLeft: "3px solid #D97706", background: "color-mix(in srgb, #D97706 8%, transparent)", borderRadius: "0 6px 6px 0" }}>
              <strong>Note from staff:</strong> {s.meta.review_note}
            </p>
          )}
          {soft && (
            <p style={{ margin: "0 0 0.5rem", color: "#92400E" }}>
              This file is on the small side ({s.meta?.original.width} px wide), so it may print soft on a letter-size sign. A larger file or an SVG will look sharper.
            </p>
          )}
          {s.meta && !compact && (
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "var(--bx-slate)" }}>
              {s.meta.original.name ?? `${s.meta.original.format.toUpperCase()} file`} · {s.meta.original.width}×{s.meta.original.height} · uploaded {new Date(s.meta.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.25rem" }}>
            {canEdit && (
              <>
                <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} style={btn("primary")}>
                  {busy ?? (has ? "Replace" : "Upload a logo")}
                </button>
                {has && !confirmRemove && (
                  <button type="button" disabled={!!busy} onClick={() => setConfirmRemove(true)} style={btn("ghost")}>
                    Remove
                  </button>
                )}
                {has && confirmRemove && (
                  <>
                    <button type="button" disabled={!!busy} onClick={remove} style={btn("danger")}>Yes, remove it</button>
                    <button type="button" disabled={!!busy} onClick={() => setConfirmRemove(false)} style={btn("ghost")}>Keep it</button>
                  </>
                )}
              </>
            )}
            {staff && has && !asking && s.status !== "approved" && (
              <button type="button" disabled={!!busy} onClick={() => review("approve")} style={btn("approve")}>Approve</button>
            )}
            {staff && has && !asking && s.status !== "rejected" && (
              <button type="button" disabled={!!busy} onClick={() => setAsking(true)} style={btn("ghost")}>Ask for a different file</button>
            )}
          </div>

          {staff && asking && (
            <div style={{ marginTop: "0.625rem", display: "grid", gap: "0.5rem" }}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="What should they send instead? (e.g. a version without the tagline, or a larger file)"
                style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.625rem", borderRadius: 8, border: "1px solid color-mix(in srgb, var(--bx-parchment) 20%, transparent)", background: "transparent", color: "inherit", font: "inherit", fontSize: "0.8125rem" }}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" disabled={!!busy} onClick={() => review("reject")} style={btn("action")}>{busy ?? "Send to planner"}</button>
                <button type="button" disabled={!!busy} onClick={() => { setAsking(false); setNote(""); }} style={btn("ghost")}>Cancel</button>
              </div>
            </div>
          )}

          {error && <p role="alert" style={{ margin: "0.5rem 0 0", color: "#dc2626" }}>{error}</p>}
          {canEdit && !compact && (
            <p style={{ margin: "0.625rem 0 0", fontSize: "0.75rem", color: "var(--bx-slate)" }}>
              PNG, JPG or SVG, up to 10 MB. By uploading, you confirm you have the right to use this mark.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function btn(kind: "primary" | "action" | "confirm" | "ghost" | "danger" | "approve"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "0.45rem 0.9rem",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    border: "1px solid transparent",
    cursor: "pointer",
    background: "transparent",
    color: "var(--bx-parchment)",
    font: "inherit",
  };
  if (kind === "primary") return { ...base, background: "var(--bx-brass)", color: "#fff" };
  if (kind === "approve") return { ...base, background: "#059669", color: "#fff" };
  if (kind === "action") return { ...base, background: "#D97706", color: "#fff" };
  if (kind === "confirm") return { ...base, background: "#059669", color: "#fff" };
  if (kind === "danger") return { ...base, background: "#dc2626", color: "#fff" };
  return { ...base, borderColor: "color-mix(in srgb, var(--bx-parchment) 20%, transparent)" };
}
