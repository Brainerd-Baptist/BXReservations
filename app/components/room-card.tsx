"use client";
import Image from "next/image";
import { useState } from "react";
import { Room } from "@/lib/rooms";

type Signal = "available" | "ask" | "unavailable" | "loading";

interface Props {
  room: Room;
  signal: Signal;
  isSelected: boolean;
  isDisabled: boolean;
  isNP: boolean;
  tag: { label: string; style: React.CSSProperties } | null;
  onToggle: () => void;
  onPreview: () => void;
  role: "main" | "extra";
  /** If true renders a compact horizontal variant for breakout lists */
  compact?: boolean;
  /** If true, hides the Select/Add button and shows a 'Reserve →' link instead */
  galleryMode?: boolean;
}

function SignalDot({ signal }: { signal: Signal }) {
  if (signal === "loading") return (
    <span className="w-2 h-2 rounded-full animate-pulse"
      style={{ background: "color-mix(in srgb, var(--bx-slate) 50%, transparent)" }} />
  );
  if (signal === "available") return (
    <span className="relative flex w-2.5 h-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ background: "#22c55e" }} />
      <span className="relative inline-flex rounded-full w-2.5 h-2.5" style={{ background: "#22c55e" }} />
    </span>
  );
  if (signal === "ask") return (
    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
  );
  return <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />;
}

function signalLabel(signal: Signal) {
  if (signal === "available") return "Available";
  if (signal === "ask") return "Check availability";
  if (signal === "unavailable") return "Unavailable";
  return "Checking…";
}

export function RoomCard({ room, signal, isSelected, isDisabled, isNP, tag, onToggle, onPreview, role, galleryMode = false }: Props) {
  const unavailable = signal === "unavailable";
  const price = isNP ? room.baseNP : room.basePro;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden transition-all duration-200 ${
        isDisabled ? "opacity-40 pointer-events-none" : "cursor-pointer"
      } ${
        isSelected
          ? "ring-2 shadow-lg scale-[1.01]"
          : "hover:scale-[1.02] hover:shadow-xl"
      }`}
      style={isSelected
        ? { boxShadow: "0 0 0 2px var(--bx-brass), 0 8px 32px rgba(0,0,0,0.3)" }
        : { boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }
      }
      onClick={onPreview}
    >
      {/* ── Photo ── */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        {!imgError ? (
          <Image
            src={room.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className={`object-cover transition-all duration-500 group-hover:scale-105 ${
              unavailable && !isSelected ? "opacity-40 grayscale" : ""
            }`}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--bx-parchment) 6%, var(--bx-ink-soft))" }}>
            <span className="text-3xl opacity-20">🏛️</span>
          </div>
        )}

        {/* Gradient overlay — always present */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)" }} />

        {/* Top-right badges row */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {/* Availability badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", color: "white" }}>
            <SignalDot signal={signal} />
            <span>{signalLabel(signal)}</span>
          </div>
        </div>

        {/* Top-left: capacity tag */}
        {tag && (
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold leading-none" style={tag.style}>
              {tag.label}
            </span>
          </div>
        )}

        {/* Preview icon — shows on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="px-4 py-2 rounded-full text-xs font-semibold text-white"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
            View room ↗
          </div>
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 inset-x-0 p-3">
          <p className="font-bold text-white text-base leading-tight drop-shadow">{room.name}</p>
          <p className="text-white/75 text-xs mt-0.5 drop-shadow">{room.tagline}</p>
        </div>
      </div>

      {/* ── Card footer ── */}
      <div className="p-3 flex items-center justify-between gap-3"
        style={{ background: isSelected
          ? "color-mix(in srgb, var(--bx-brass) 8%, var(--bx-ink-soft))"
          : "var(--bx-ink-soft)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1 text-xs shrink-0"
            style={{ color: "var(--bx-slate)" }}>
            <span>👥</span>
            <span>{room.capacityTheater}</span>
          </div>
          <div className="w-px h-3" style={{ background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }} />
          <p className="text-xs font-semibold truncate" style={{ color: "var(--bx-parchment)" }}>
            from ${price.toLocaleString()}<span className="font-normal" style={{ color: "var(--bx-slate)" }}>/4 hrs</span>
          </p>
        </div>

        {galleryMode ? (
          <a
            href="/reserve"
            onClick={e => e.stopPropagation()}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--bx-brass)", color: "white" }}
          >
            Reserve →
          </a>
        ) : (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
            style={isSelected
              ? { background: "var(--bx-brass)", color: "white" }
              : unavailable
              ? { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }
              : { background: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }
            }
          >
            {isSelected
              ? "✓ Selected"
              : unavailable
              ? "Request"
              : role === "main" ? "Select" : "Add"}
          </button>
        )}
      </div>

      {/* Selected brass border glow */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 2px var(--bx-brass)" }} />
      )}
    </div>
  );
}
