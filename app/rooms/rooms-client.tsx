"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ROOMS, type Room, type SetupId } from "@/lib/rooms";
import { RoomCard } from "@/app/components/room-card";
import { RoomLightbox } from "@/app/components/room-lightbox";

// ── Filter types ─────────────────────────────────────────────────────────────
type FloorFilter = "all" | "upper" | "main" | "lower";
type CapacityFilter = "all" | "small" | "medium" | "large";
const SETUP_FILTER_IDS: SetupId[] = ["theater", "banquet", "reception", "cocktail", "classroom", "boardroom"];

const SETUP_LABELS: Record<SetupId, string> = {
  theater: "Theater", banquet: "Banquet", reception: "Reception",
  cocktail: "Cocktail", classroom: "Classroom", boardroom: "Boardroom", custom: "Custom",
};

const FLOOR_LABELS: Record<FloorFilter, string> = {
  all: "All Floors", upper: "Upper Level", main: "Main Level", lower: "Lower Level",
};

const CAP_LABELS: Record<CapacityFilter, string> = {
  all: "Any size", small: "Under 50", medium: "50–150", large: "150+",
};

function matchesCapacity(room: Room, cap: CapacityFilter): boolean {
  const n = room.capacityTheater;
  if (cap === "small") return n < 50;
  if (cap === "medium") return n >= 50 && n <= 150;
  if (cap === "large") return n > 150;
  return true;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function RoomsClient() {
  const [floor, setFloor] = useState<FloorFilter>("all");
  const [cap, setCap] = useState<CapacityFilter>("all");
  const [setup, setSetup] = useState<SetupId | "all">("all");
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);

  const filtered = useMemo(() => ROOMS.filter(r => {
    if (floor !== "all" && r.floor !== floor) return false;
    if (!matchesCapacity(r, cap)) return false;
    if (setup !== "all" && !(r.setups as readonly string[]).includes(setup)) return false;
    return true;
  }), [floor, cap, setup]);

  return (
    <main className="min-h-screen relative overflow-x-hidden" style={{ background: "var(--bx-ink)" }}>
      {/* Bloom glow */}
      <div className="bx-bloom" aria-hidden="true" />

      {/* ── Filters ── */}
      <section className="sticky top-14 z-10 border-b" style={{ background: "color-mix(in srgb, var(--bx-ink) 92%, transparent)", backdropFilter: "blur(12px)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center">

          {/* Floor */}
          <div className="flex items-center gap-1 mr-1">
            {(["all", "upper", "main", "lower"] as FloorFilter[]).map(f => (
              <button key={f} onClick={() => setFloor(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={floor === f
                  ? { background: "var(--bx-brass)", color: "#fff" }
                  : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)" }
                }>
                {FLOOR_LABELS[f]}
              </button>
            ))}
          </div>

          <div className="w-px h-4 hidden sm:block" style={{ background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }} />

          {/* Capacity */}
          <div className="flex items-center gap-1 mr-1">
            {(["all", "small", "medium", "large"] as CapacityFilter[]).map(c => (
              <button key={c} onClick={() => setCap(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={cap === c
                  ? { background: "color-mix(in srgb, var(--bx-brass) 20%, transparent)", color: "var(--bx-brass)", border: "1px solid color-mix(in srgb, var(--bx-brass) 40%, transparent)" }
                  : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid transparent" }
                }>
                {CAP_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="w-px h-4 hidden sm:block" style={{ background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }} />

          {/* Setup */}
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setSetup("all")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={setup === "all"
                ? { background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 25%, transparent)" }
                : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid transparent" }
              }>
              Any setup
            </button>
            {SETUP_FILTER_IDS.map(sid => (
              <button key={sid} onClick={() => setSetup(sid)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={setup === sid
                  ? { background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 25%, transparent)" }
                  : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid transparent" }
                }>
                {SETUP_LABELS[sid]}
              </button>
            ))}
          </div>

          {/* Result count */}
          {filtered.length < ROOMS.length && (
            <span className="ml-auto text-xs" style={{ color: "var(--bx-slate)" }}>
              {filtered.length} of {ROOMS.length}
            </span>
          )}
        </div>
      </section>

      {/* ── Grid ── */}
      <section className="max-w-5xl mx-auto px-4 py-8">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold mb-1" style={{ color: "var(--bx-parchment)" }}>No spaces match these filters</p>
            <button onClick={() => { setFloor("all"); setCap("all"); setSetup("all"); }}
              className="mt-4 text-sm font-medium" style={{ color: "var(--bx-brass)" }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {(["main", "upper", "lower"] as const).map(f => {
              const rooms = filtered.filter(r => r.floor === f);
              if (rooms.length === 0) return null;
              const floorLabel = f === "main" ? "Main Level" : f === "upper" ? "Upper Level" : "Lower Level";
              return (
                <div key={f} className="mb-10">
                  {floor === "all" && (
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--bx-slate)" }}>
                        {floorLabel}
                      </span>
                      <div className="flex-1 h-px" style={{ background: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }} />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {rooms.map(room => (
                      <div key={room.id} id={room.id} className="scroll-mt-20">
                      <RoomCard
                        key={room.id}
                        room={room}
                        signal="available"
                        isSelected={false}
                        isDisabled={false}
                        isNP={false}
                        tag={null}
                        onToggle={() => {}}
                        onPreview={() => setPreviewRoom(room)}
                        role="main"
                        galleryMode
                      />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </section>

      {/* ── CTA strip ── */}
      <section className="border-t" style={{ background: "var(--bx-ink-soft)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
        <div className="max-w-2xl mx-auto px-5 py-12 text-center">
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--bx-parchment)" }}>Ready to book?</h2>
          <p className="text-sm mb-6" style={{ color: "var(--bx-slate)" }}>
            Submit a reservation request and our team will follow up within 1–2 business days.
          </p>
          <Link
            href="/reserve"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--bx-brass)" }}
          >
            Start your reservation →
          </Link>
        </div>
      </section>

      {/* ── Lightbox ── */}
      <RoomLightbox
        room={previewRoom}
        isSelected={false}
        isNP={false}
        onClose={() => setPreviewRoom(null)}
        onToggle={() => {}}
        galleryMode
      />
    </main>
  );
}
