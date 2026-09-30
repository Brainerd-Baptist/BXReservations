/**
 * Skeleton loading components — Phase 3 of the BX design upgrade.
 * Uses CSS shimmer animation from globals.css (.bx-skeleton / .bx-shimmer).
 */

import React from "react";

// ── Primitive ──────────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function Skeleton({ width = "100%", height = "1rem", borderRadius = "6px", style, className }: SkeletonProps) {
  return (
    <div
      className={`bx-skeleton${className ? ` ${className}` : ""}`}
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}

// ── Reservation row skeleton (admin list) ─────────────────────────────────

export function ReservationRowSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 7%, transparent)",
      }}
    >
      {/* Status dot */}
      <Skeleton width="8px" height="8px" borderRadius="50%" style={{ flexShrink: 0 }} />
      {/* Event name */}
      <Skeleton width="30%" height="0.8125rem" />
      {/* Org */}
      <Skeleton width="18%" height="0.8125rem" />
      {/* Date */}
      <Skeleton width="12%" height="0.8125rem" />
      {/* Doc icons */}
      <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
        <Skeleton width="13px" height="13px" borderRadius="3px" />
        <Skeleton width="13px" height="13px" borderRadius="3px" />
        <Skeleton width="13px" height="13px" borderRadius="3px" />
      </div>
    </div>
  );
}

export function ReservationListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bx-shimmer" style={{ borderRadius: "12px", overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <ReservationRowSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Card skeleton (reservation detail sections) ───────────────────────────

export function CardSkeleton({ lines = 3, height = "120px" }: { lines?: number; height?: string }) {
  return (
    <div
      className="bx-shimmer"
      style={{
        background: "var(--bx-surface)",
        border: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)",
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        marginBottom: "1rem",
        minHeight: height,
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      <Skeleton width="40%" height="0.6875rem" borderRadius="4px" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "65%" : "100%"} height="0.8125rem" borderRadius="4px" />
      ))}
    </div>
  );
}

// ── Org list skeleton ─────────────────────────────────────────────────────

export function OrgRowSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid color-mix(in srgb, var(--bx-parchment) 7%, transparent)",
      }}
    >
      <Skeleton width="32px" height="32px" borderRadius="8px" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <Skeleton width="45%" height="0.8125rem" />
        <Skeleton width="28%" height="0.6875rem" />
      </div>
      <Skeleton width="60px" height="1.5rem" borderRadius="9999px" />
    </div>
  );
}

export function OrgListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bx-shimmer" style={{ borderRadius: "12px", overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <OrgRowSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Inline text skeleton (small "Loading…" replacements) ──────────────────

export function InlineSkeleton({ width = "80px" }: { width?: string }) {
  return <Skeleton width={width} height="0.75rem" borderRadius="4px" style={{ display: "inline-block" }} />;
}
