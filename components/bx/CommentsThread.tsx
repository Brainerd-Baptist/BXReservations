"use client";
import { useState, useEffect, useCallback } from "react";

export interface Comment {
  id: string;
  author_name: string;
  author_role: "admin" | "user";
  body: string;
  internal_only?: boolean;
  created_at: string;
}

interface Props {
  reservationId: string;
  fetchUrl: string;
  postUrl: string;
  canInternal?: boolean;   // admin can toggle internal_only
  autoLoad?: boolean;      // load immediately (user view) vs on-demand (admin view)
}

function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const init = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: "50%",
      background: "color-mix(in srgb, var(--bx-brass) 20%, transparent)",
      border: "1px solid color-mix(in srgb, var(--bx-brass) 35%, transparent)",
      fontSize: "0.6875rem",
      fontWeight: 700,
      color: "var(--bx-accent-text)",
      flex: "none",
    }}>{init}</span>
  );
}

export default function CommentsThread({ reservationId, fetchUrl, postUrl, canInternal = false, autoLoad = true }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft]     = useState("");
  const [internalOnly, setInternalOnly] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(fetchUrl);
      if (res.ok) setComments(await res.json());
    } catch (e) {
      console.error("[CommentsThread] load failed:", e);
    }
    setLoaded(true);
    setLoading(false);
  }, [fetchUrl]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  async function post() {
    if (!draft.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim(), internal_only: internalOnly }),
      });
      if (res.ok) {
        const c: Comment = await res.json();
        setComments((prev) => [...prev, c]);
        setDraft("");
        setInternalOnly(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setPostError(err.error ?? "Failed to post comment.");
      }
    } catch {
      setPostError("Network error. Please try again.");
    }
    setPosting(false);
  }

  if (!autoLoad && !loaded) {
    return (
      <button
        onClick={load}
        style={{ background: "none", border: "none", padding: 0, fontSize: "0.8125rem", color: "var(--bx-accent-text)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
      >
        Load messages {loading && "…"}
      </button>
    );
  }

  return (
    <div>
      {/* Thread */}
      {loading && <p style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", margin: "0 0 0.75rem" }}>Loading…</p>}
      {loaded && comments.length === 0 && (
        <p style={{ fontSize: "0.8125rem", color: "var(--bx-slate)", margin: "0 0 0.75rem" }}>No messages yet.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: comments.length ? "1rem" : 0 }}>
        {comments.map((c) => {
          const isInternal = c.internal_only;
          const isAdmin = c.author_role === "admin";
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                gap: "0.625rem",
                alignItems: "flex-start",
                opacity: isInternal ? 0.7 : 1,
              }}
            >
              <Initials name={c.author_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--bx-parchment)" }}>{c.author_name}</span>
                  {isAdmin && <span style={{ fontSize: "0.6875rem", color: "var(--bx-accent-text)", fontWeight: 600, letterSpacing: "0.04em" }}>BX TEAM</span>}
                  {isInternal && <span style={{ fontSize: "0.6875rem", color: "var(--bx-slate)", fontStyle: "italic" }}>internal note</span>}
                  <span style={{ fontSize: "0.75rem", color: "var(--bx-slate)" }}>{fmtTs(c.created_at)}</span>
                </div>
                <div
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0 8px 8px 8px",
                    background: isInternal
                      ? "color-mix(in srgb, var(--bx-slate) 10%, transparent)"
                      : isAdmin
                        ? "color-mix(in srgb, var(--bx-brass) 10%, transparent)"
                        : "color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                    border: `1px solid ${isInternal
                      ? "color-mix(in srgb, var(--bx-slate) 15%, transparent)"
                      : isAdmin
                        ? "color-mix(in srgb, var(--bx-brass) 20%, transparent)"
                        : "color-mix(in srgb, var(--bx-parchment) 10%, transparent)"}`,
                    fontSize: "0.875rem",
                    color: "var(--bx-parchment)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {c.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div style={{ borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 8%, transparent)", paddingTop: "0.75rem" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(); }}
          placeholder={canInternal ? "Write a message or internal note…" : "Write a message to the BX team…"}
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "0.5rem 0.625rem",
            borderRadius: "6px",
            border: "1px solid color-mix(in srgb, var(--bx-parchment) 14%, transparent)",
            background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)",
            color: "var(--bx-parchment)",
            fontSize: "0.875rem",
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />
        {canInternal && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.375rem", fontSize: "0.8125rem", color: "var(--bx-slate)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={internalOnly}
              onChange={(e) => setInternalOnly(e.target.checked)}
              style={{ accentColor: "var(--bx-brass)" }}
            />
            Internal note only (not visible to requester)
          </label>
        )}
        {postError && <p style={{ margin: "0.375rem 0 0", fontSize: "0.8125rem", color: "#EF4444" }}>{postError}</p>}
        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <button
            onClick={post}
            disabled={posting || !draft.trim()}
            style={{
              padding: "0.4375rem 1rem",
              borderRadius: "6px",
              border: "none",
              background: "var(--bx-brass)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: posting || !draft.trim() ? "not-allowed" : "pointer",
              opacity: posting || !draft.trim() ? 0.5 : 1,
            }}
          >
            {posting ? "Sending…" : internalOnly ? "Add note" : "Send"}
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--bx-slate)" }}>⌘↵ to send</span>
        </div>
      </div>
    </div>
  );
}
