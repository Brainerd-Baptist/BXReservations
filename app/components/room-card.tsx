"use client";
import Image from "next/image";
import { useState } from "react";
import { Room } from "@/lib/rooms";
import { useBlockPrice, useNoCharge } from "@/lib/room-price-context";

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
  const blockPrice = useBlockPrice(room.id, isNP);
  const noCharge = useNoCharge();
  const price = blockPrice;
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
        ? { boxShadow: "0 0 0 2px var(--bx-brass), 0 0 32px -4px color-mix(in srgb, var(--bx-brass) 45%, transparent), var(--shadow-3)" }
        : { boxShadow: "0 0 0 1px var(--bx-hairline), var(--shadow-2)" }
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
            <span style={{opacity:0.2,color:"var(--bx-slate)"}}><svg width="1.5rem" height="1.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"inline",verticalAlign:"-0.15em",opacity:0.2}}><path d="M3 22V9l9-7 9 7v13"/><path d="M9 22v-5a3 3 0 016 0v5"/></svg></span>
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
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none">
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

        {/* Keyboard + screen-reader way to open the preview (the card itself
            is only mouse-clickable) — audit F11 */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          aria-label={`View ${room.name} photos and details`}
          className="absolute inset-0 rounded-t-2xl focus-visible:outline-offset-[-3px]"
        />
      </div>

      {/* ── Card footer ── */}
      <div className="p-3 flex items-center justify-between gap-3"
        style={{ background: isSelected
          ? "color-mix(in srgb, var(--bx-brass) 10%, var(--bx-surface-strong))"
          : "var(--bx-surface-strong)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1 text-xs shrink-0"
            style={{ color: "var(--bx-slate)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-70">
              <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 17a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
            </svg>
            <span>{room.capacityTheater}</span>
          </div>
          <div className="w-px h-3" style={{ background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }} />
          <p className="text-xs font-semibold truncate" style={{ color: "var(--bx-parchment)" }}>
            {noCharge ? "No charge · church use" : <>from ${price.toLocaleString()}<span className="font-normal" style={{ color: "var(--bx-slate)" }}>/4 hrs</span></>}
          </p>
        </div>

        {galleryMode ? (
          <a
            href="/reserve"
            onClick={e => e.stopPropagation()}
            className="shrink-0 inline-flex items-center min-h-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" }}
          >
            Reserve →
          </a>
        ) : (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className="shrink-0 inline-flex items-center min-h-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
            style={isSelected
              ? { background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" }
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
