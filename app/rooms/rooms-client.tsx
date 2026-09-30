"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROOMS, type Room, type SetupId } from "@/lib/rooms";
import { RoomCard } from "@/app/components/room-card";
import { RoomLightbox } from "@/app/components/room-lightbox";

// ── Filter types ─────────────────────────────────────────────────────────────
type FloorFilter = "all" | "upstairs" | "downstairs";
type CapacityFilter = "all" | "small" | "medium" | "large";

const SETUP_FILTER_IDS: SetupId[] = ["theater", "banquet", "reception", "cocktail", "classroom", "boardroom"];

const SETUP_LABELS: Record<SetupId, string> = {
  theater: "Theater", banquet: "Banquet", reception: "Reception",
  cocktail: "Cocktail", classroom: "Classroom", boardroom: "Boardroom", custom: "Custom",
};

const FLOOR_LABELS: Record<FloorFilter, string> = {
  all: "All Floors", upstairs: "Upstairs", downstairs: "Downstairs",
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
  const router = useRouter();
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
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Bloom glow */}
      <div className="bx-bloom" aria-hidden="true" />

      {/* ── Filters ── */}
      <section className="bx-glass-strong sticky z-10 border-x-0 border-t-0" style={{ top: "var(--bx-header-h)", boxShadow: "none" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center">

          {/* Floor */}
          <div className="flex items-center gap-1 mr-1">
            {(["all", "upstairs", "downstairs"] as FloorFilter[]).map(f => (
              <button key={f} onClick={() => setFloor(f)} aria-pressed={floor === f}
                className="px-3 py-1.5 min-h-10 rounded-lg text-xs font-medium transition-all"
                style={floor === f
                  ? { background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" }
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
              <button key={c} onClick={() => setCap(c)} aria-pressed={cap === c}
                className="px-3 py-1.5 min-h-10 rounded-lg text-xs font-medium transition-all"
                style={cap === c
                  ? { background: "color-mix(in srgb, var(--bx-brass) 20%, transparent)", color: "var(--bx-accent-text)", border: "1px solid color-mix(in srgb, var(--bx-brass) 40%, transparent)" }
                  : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid transparent" }
                }>
                {CAP_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="w-px h-4 hidden sm:block" style={{ background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }} />

          {/* Setup */}
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setSetup("all")} aria-pressed={setup === "all"}
              className="px-3 py-1.5 min-h-10 rounded-lg text-xs font-medium transition-all"
              style={setup === "all"
                ? { background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 25%, transparent)" }
                : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid transparent" }
              }>
              Any setup
            </button>
            {SETUP_FILTER_IDS.map(sid => (
              <button key={sid} onClick={() => setSetup(sid)} aria-pressed={setup === sid}
                className="px-3 py-1.5 min-h-10 rounded-lg text-xs font-medium transition-all"
                style={setup === sid
                  ? { background: "color-mix(in srgb, var(--bx-parchment) 15%, transparent)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 25%, transparent)" }
                  : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid transparent" }
                }>
                {SETUP_LABELS[sid]}
              </button>
            ))}
          </div>

          {/* Count + Grid/Map toggle */}
          <div className="flex items-center gap-2 ml-auto">
            {filtered.length < ROOMS.length && (
              <span className="text-xs" style={{ color: "var(--bx-slate)" }}>
                {filtered.length} of {ROOMS.length}
              </span>
            )}
            <div className="flex items-center rounded-lg overflow-hidden"
              style={{ border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)" }}>
              {/* Grid — current view */}
              <button
                className="px-3 py-1 min-h-10 text-xs font-medium transition-all"
                style={{ background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" }}
                disabled
              >
                ⊞ Grid
              </button>
              {/* Map — navigates to the interactive floor plan */}
              <button
                onClick={() => router.push("/bx-map")}
                className="px-3 py-1 min-h-10 text-xs font-medium transition-all"
                style={{ background: "transparent", color: "var(--bx-slate)" }}
              >
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{display:"inline",verticalAlign:"-0.1em"}}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> Map
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content: Grid ── */}
      <section className="max-w-5xl mx-auto px-4 py-8">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div style={{marginBottom:"0.75rem",color:"var(--bx-slate)"}}><svg width="2.5rem" height="2.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"block",margin:"0 auto"}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div>
            <p className="font-semibold mb-1" style={{ color: "var(--bx-parchment)" }}>No spaces match these filters</p>
            <button onClick={() => { setFloor("all"); setCap("all"); setSetup("all"); }}
              className="mt-4 text-sm font-medium" style={{ color: "var(--bx-accent-text)" }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {(["upstairs", "downstairs"] as const).map(f => {
              const rooms = filtered.filter(r => r.floor === f);
              if (rooms.length === 0) return null;
              const floorLabel = f === "upstairs" ? "Upstairs" : "Downstairs";
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
      <section className="bx-band border-t">
        <div className="max-w-2xl mx-auto px-5 py-12 text-center">
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--bx-parchment)" }}>Ready to book?</h2>
          <p className="text-sm mb-6" style={{ color: "var(--bx-slate)" }}>
            Submit a reservation request and our team will follow up within 1–2 business days.
          </p>
          <Link
            href="/reserve"
            className="bx-cta inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-brass text-[var(--bx-action-fg)] active:scale-[0.98]"
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
    </div>
  );
}
