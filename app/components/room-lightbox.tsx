"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Room } from "@/lib/rooms";

interface Props {
  room: Room | null;
  isSelected: boolean;
  isNP: boolean;
  onClose: () => void;
  onToggle: () => void;
}

const SETUP_LABELS: Record<string, string> = {
  theater: "Theater", banquet: "Banquet", reception: "Reception",
  cocktail: "Cocktail", classroom: "Classroom", boardroom: "Boardroom", custom: "Custom",
};

export function RoomLightbox({ room, isSelected, isNP, onClose, onToggle }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0);

  // Reset photo index when room changes
  useEffect(() => { setPhotoIdx(0); }, [room?.id]);

  const prev = useCallback(() => {
    if (!room) return;
    setPhotoIdx(i => (i - 1 + room.photos.length) % room.photos.length);
  }, [room]);

  const next = useCallback(() => {
    if (!room) return;
    setPhotoIdx(i => (i + 1) % room.photos.length);
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [room, onClose, prev, next]);

  // Lock body scroll while open
  useEffect(() => {
    if (room) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [room]);

  if (!room) return null;

  const photo = room.photos[photoIdx];
  const price = isNP ? room.baseNP : room.basePro;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col lg:flex-row"
        style={{ background: "var(--bx-ink-soft)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
          style={{ background: "rgba(0,0,0,0.5)", color: "var(--bx-parchment)" }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* ── Image carousel ── */}
        <div className="relative lg:w-[55%] flex-shrink-0">
          <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
            <Image
              src={photo.src}
              alt={photo.caption}
              fill
              className="object-cover rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none"
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority
            />
            {/* Gradient overlay for caption */}
            <div
              className="absolute inset-x-0 bottom-0 h-20 rounded-bl-none lg:rounded-bl-2xl"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
            />
            <p className="absolute bottom-3 left-4 right-12 text-xs text-white/80 font-medium">
              {photo.caption}
            </p>
          </div>

          {/* Navigation arrows */}
          {room.photos.length > 1 && (
            <>
              <button onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all hover:scale-105"
                style={{ background: "rgba(0,0,0,0.55)" }}
              >‹</button>
              <button onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all hover:scale-105"
                style={{ background: "rgba(0,0,0,0.55)" }}
              >›</button>
              {/* Dot indicators */}
              <div className="absolute bottom-3 right-4 flex gap-1.5">
                {room.photos.map((_, i) => (
                  <button key={i} onClick={() => setPhotoIdx(i)}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{ background: i === photoIdx ? "white" : "rgba(255,255,255,0.35)" }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Details panel ── */}
        <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Header */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--bx-brass)" }}>
              {room.floor === "upper" ? "Upper Level" : room.floor === "lower" ? "Lower Level" : "Main Level"}
            </p>
            <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--bx-parchment)" }}>
              {room.name}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--bx-slate)" }}>
              {room.description}
            </p>
          </div>

          {/* Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center"
              style={{ background: "color-mix(in srgb, var(--bx-parchment) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
              <p className="text-2xl font-bold" style={{ color: "var(--bx-parchment)" }}>{room.capacityTheater}</p>
              <p className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "var(--bx-slate)" }}>Theater</p>
            </div>
            <div className="rounded-xl p-3 text-center"
              style={{ background: "color-mix(in srgb, var(--bx-parchment) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
              <p className="text-2xl font-bold" style={{ color: "var(--bx-parchment)" }}>{room.capacityBanquet}</p>
              <p className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "var(--bx-slate)" }}>Banquet</p>
            </div>
          </div>

          {/* Features */}
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "var(--bx-slate)" }}>Features</p>
            <div className="flex flex-wrap gap-1.5">
              {room.features.map(f => (
                <span key={f} className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: "color-mix(in srgb, var(--bx-brass) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--bx-brass) 25%, transparent)",
                    color: "var(--bx-parchment)",
                  }}>{f}</span>
              ))}
            </div>
          </div>

          {/* Setup styles */}
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "var(--bx-slate)" }}>Setup Styles</p>
            <div className="flex flex-wrap gap-1.5">
              {room.setups.map(s => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
                    color: "var(--bx-slate)",
                  }}>{SETUP_LABELS[s] ?? s}</span>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-xl p-4"
            style={{
              background: "color-mix(in srgb, var(--bx-brass) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--bx-brass) 20%, transparent)",
            }}>
            <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "var(--bx-brass)" }}>
              Starting Rate
            </p>
            <p className="text-3xl font-bold" style={{ color: "var(--bx-parchment)" }}>
              ${price.toLocaleString()}
              <span className="text-sm font-normal ml-1" style={{ color: "var(--bx-slate)" }}>/ 4 hrs</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--bx-slate)" }}>
              {isNP ? "Non-profit rate" : "Standard rate"} · Final pricing confirmed by our team
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={() => { onToggle(); onClose(); }}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={isSelected
              ? { background: "color-mix(in srgb, var(--bx-brass) 15%, transparent)", color: "var(--bx-brass)", border: "1px solid var(--bx-brass)" }
              : { background: "var(--bx-brass)", color: "white" }
            }
          >
            {isSelected ? "✓ Selected — click to remove" : "Select this space →"}
          </button>
        </div>
      </div>
    </div>
  );
}
