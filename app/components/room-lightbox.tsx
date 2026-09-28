"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Room } from "@/lib/rooms";

interface Props {
  room: Room | null;
  isSelected: boolean;
  isNP: boolean;
  onClose: () => void;
  onToggle: () => void;
  /** When true, CTA links to /reserve instead of calling onToggle */
  galleryMode?: boolean;
}

const SETUP_LABELS: Record<string, string> = {
  theater: "Theater", banquet: "Banquet", reception: "Reception",
  cocktail: "Cocktail", classroom: "Classroom", boardroom: "Boardroom", custom: "Custom",
};

export function RoomLightbox({ room, isSelected, isNP, onClose, onToggle, galleryMode = false }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const scrollYRef = useRef(0);

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

  // iOS-safe body scroll lock: fix the body in place at its current scroll position
  // so it doesn't jump or bounce behind the modal on iOS Safari.
  useEffect(() => {
    if (room) {
      scrollYRef.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = "100%";
    } else {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollYRef.current);
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    };
  }, [room]);

  if (!room) return null;

  const photo = room.photos[photoIdx];
  const price = isNP ? room.baseNP : room.basePro;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      {/* Centering wrapper — min-h-full fills the scrollable space so items-center works
          even when content is shorter than the viewport; when content is taller the
          overlay scrolls instead of clipping the top on mobile. */}
      <div className="flex min-h-full items-center justify-center p-4">
      {/* Close button — fixed to viewport so it's always reachable no matter how far the modal scrolls */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
        style={{ background: "rgba(0,0,0,0.65)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}
        aria-label="Close"
      >
        ✕
      </button>

      {/* Modal card
          Single scroll container — only this div scrolls; the details panel must NOT have
          its own overflow-y-auto, otherwise iOS Safari creates nested scroll which breaks. */}
      <div
        className="relative w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col lg:flex-row"
        style={{
          background: "var(--bx-ink-soft)",
          border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Image carousel ── */}
        <div className="lg:w-[55%] flex-shrink-0 flex flex-col">

          {/* Image container — arrows are positioned relative to THIS div, not the outer column */}
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: "4/3", maxHeight: "clamp(200px, 50vw, 480px)" }}
          >
            <Image
              src={photo.src}
              alt={photo.caption}
              fill
              className="object-cover rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none"
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority
            />
            {/* Caption gradient */}
            <div
              className="absolute inset-x-0 bottom-0 h-20"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
            />
            <p className="absolute bottom-3 left-4 right-4 text-xs text-white/80 font-medium line-clamp-2">
              {photo.caption}
            </p>

            {/* Nav arrows — inside the image container so top-1/2 bisects the image, not the whole column */}
            {room.photos.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); prev(); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-base transition-all hover:scale-105 active:scale-95"
                  style={{ background: "rgba(0,0,0,0.55)", touchAction: "manipulation" }}
                  aria-label="Previous photo"
                >‹</button>
                <button
                  onClick={e => { e.stopPropagation(); next(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-base transition-all hover:scale-105 active:scale-95"
                  style={{ background: "rgba(0,0,0,0.55)", touchAction: "manipulation" }}
                  aria-label="Next photo"
                >›</button>
              </>
            )}
          </div>

          {/* Dot indicators sit below the image, inside the column but outside the image container */}
          {room.photos.length > 1 && (
            <div className="flex justify-center gap-2 py-3">
              {room.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setPhotoIdx(i); }}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ background: i === photoIdx ? "white" : "rgba(255,255,255,0.3)" }}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Details panel ──
            No overflow-y-auto here — the outer modal card is the single scroll container.
            Removing it prevents the broken nested-scroll on iOS that hid all this content. */}
        <div className="flex-1 p-6 flex flex-col gap-5">
          {/* Header */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--bx-brass)" }}>
              {room.floor === "upstairs" ? "Upstairs" : "Downstairs"}
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
          {galleryMode ? (
            <Link
              href="/reserve"
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] text-center inline-block"
              style={{ background: "var(--bx-brass)", color: "white" }}
            >
              Reserve this space →
            </Link>
          ) : (
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
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
