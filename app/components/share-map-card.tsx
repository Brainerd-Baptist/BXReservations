"use client";

// Share the event map — a read-only link anyone can open, no sign-in.
// Turn on, copy, download a QR, issue a fresh link, or turn off.

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

interface ShareState { enabled: boolean; token: string | null; path: string | null }

export default function ShareMapCard({
  reservationId,
  initial,
  eventName,
  locked,
}: {
  reservationId: string;
  initial: ShareState;
  eventName: string;
  /** Why sharing can't be turned on yet (null = allowed). */
  locked: string | null;
}) {
  const [state, setState] = useState<ShareState>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // the origin is only known in the browser; read it lazily so SSR and the first paint agree
  const [origin, setOrigin] = useState("");
  const api = `/api/event-map/${reservationId}/share`;
  useEffect(() => {
    const id = requestAnimationFrame(() => setOrigin(window.location.origin));
    return () => cancelAnimationFrame(id);
  }, []);
  const url = state.path ? `${origin}${state.path}` : null;

  const call = useCallback(
    async (method: "POST" | "DELETE", body?: unknown, label = "Working…") => {
      setError(null);
      setBusy(label);
      try {
        const r = await fetch(api, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Something went wrong");
        setState(await r.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    },
    [api]
  );

  const copy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy — select the link and copy it yourself.");
    }
  }, [url]);

  const downloadQr = useCallback(async () => {
    if (!url) return;
    const png = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 1024, color: { dark: "#00205b", light: "#ffffff" } });
    const a = document.createElement("a");
    a.href = png;
    a.download = `${eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "event"}-map-qr.png`;
    a.click();
  }, [url, eventName]);

  const btn = (kind: "primary" | "ghost" | "danger"): React.CSSProperties => ({
    padding: "0.45rem 0.9rem",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    cursor: "pointer",
    font: "inherit",
    border: kind === "ghost" ? "1px solid color-mix(in srgb, var(--bx-parchment) 20%, transparent)" : "1px solid transparent",
    background: kind === "primary" ? "var(--bx-brass)" : kind === "danger" ? "transparent" : "transparent",
    color: kind === "primary" ? "#fff" : kind === "danger" ? "var(--bx-clay)" : "var(--bx-parchment)",
  });

  return (
    <section
      id="share"
      aria-label="Share the event map"
      style={{
        border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        marginBottom: "1rem",
        background: "var(--bx-surface)", backdropFilter: "blur(var(--bx-blur)) saturate(150%)", WebkitBackdropFilter: "blur(var(--bx-blur)) saturate(150%)", boxShadow: "inset 0 1px 0 var(--bx-highlight), var(--shadow-2)",
        color: "var(--bx-parchment)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bx-slate)" }}>
          Share the event map
        </h2>
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 9999,
            fontSize: "0.75rem",
            fontWeight: 600,
            background: state.enabled ? "var(--tone-green-bg)" : "color-mix(in srgb, var(--bx-parchment) 8%, transparent)",
            color: state.enabled ? "var(--tone-green-fg)" : "var(--bx-slate)",
          }}
        >
          {state.enabled ? "Link is on" : "Off"}
        </span>
      </div>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", lineHeight: 1.5, color: "var(--bx-slate)" }}>
        Anyone with the link sees your room names and setups on the building map — volunteers, vendors, attendees — with no sign-in.
        Staff notes never appear. The QR on your door signs points here while the link is on. Turn it off any time.
      </p>
      {locked && !state.enabled && <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--tone-amber-fg)" }}>{locked}</p>}

      {state.enabled && url && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share link"
            style={{ flex: "1 1 240px", minWidth: 0, padding: "0.5rem 0.625rem", borderRadius: 8, border: "1px solid color-mix(in srgb, var(--bx-parchment) 20%, transparent)", background: "transparent", color: "inherit", font: "inherit", fontSize: "0.8125rem" }}
          />
          <button type="button" onClick={copy} style={btn("primary")}>{copied ? "Copied" : "Copy link"}</button>
          <button type="button" onClick={downloadQr} style={btn("ghost")}>Download QR</button>
          <a href={state.path!} target="_blank" rel="noopener" style={{ ...btn("ghost"), textDecoration: "none", display: "inline-block" }}>Open</a>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {!state.enabled ? (
          <button type="button" disabled={!!busy || !!locked} onClick={() => call("POST", undefined, "Turning on…")} style={{ ...btn("primary"), opacity: locked ? 0.45 : 1 }}>
            {busy ?? "Turn the link on"}
          </button>
        ) : (
          <>
            <button type="button" disabled={!!busy} onClick={() => call("POST", { rotate: true }, "Issuing…")} style={btn("ghost")}>
              {busy === "Issuing…" ? busy : "Issue a new link"}
            </button>
            <button type="button" disabled={!!busy} onClick={() => call("DELETE", undefined, "Turning off…")} style={btn("danger")}>
              {busy === "Turning off…" ? busy : "Turn the link off"}
            </button>
          </>
        )}
      </div>
      {error && <p role="alert" style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--bx-clay)" }}>{error}</p>}
    </section>
  );
}
