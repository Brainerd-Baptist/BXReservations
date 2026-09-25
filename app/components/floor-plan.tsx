"use client";

import { useState } from "react";
import { ROOMS, type Room } from "@/lib/rooms";

// ── Room shape definitions ────────────────────────────────────────────────────
interface Shape {
  id: string | null;        // matches ROOMS id; null = non-reservable
  label: string;
  sub?: string;             // secondary label (capacity)
  x: number; y: number; w: number; h: number;
  reservable: boolean;
  labelSize?: "xs" | "sm" | "md" | "lg";
}

// ── Downstairs layout ─────────────────────────────────────────────────────────
// viewBox: 0 0 990 410
// Left col (0–490): small rooms at top, The Crossing fills bottom
// Middle col (490–610): Kitchen at top, CrossPointe A/B/C stacked below
// Right col (610–990): Basketball court, full height

const DOWNSTAIRS: Shape[] = [
  // — Non-reservable
  { id: null, label: "Playroom",          x:   0, y:   0, w:  95, h: 120, reservable: false, labelSize: "xs" },
  { id: null, label: "Nursery",           x:  95, y:   0, w:  90, h: 120, reservable: false, labelSize: "xs" },
  { id: null, label: "Café",              x: 185, y:   0, w: 115, h: 120, reservable: false, labelSize: "xs" },
  { id: null, label: "",                  x: 300, y:   0, w: 190, h: 120, reservable: false }, // corridor/lobby
  { id: null, label: "Kitchen",           x: 490, y:   0, w: 120, h: 120, reservable: false, labelSize: "xs" },
  { id: null, label: "Basketball Court",  x: 610, y:   0, w: 380, h: 410, reservable: false, labelSize: "md" },
  // — Reservable
  { id: "crossing",      label: "The Crossing",  sub: "400 seats",  x:   0, y: 120, w: 490, h: 290, reservable: true,  labelSize: "lg" },
  { id: "crosspointe-a", label: "CrossPointe A", sub: "40 seats",   x: 490, y: 120, w: 120, h:  97, reservable: true,  labelSize: "xs" },
  { id: "crosspointe-b", label: "CrossPointe B", sub: "40 seats",   x: 490, y: 217, w: 120, h:  97, reservable: true,  labelSize: "xs" },
  { id: "crosspointe-c", label: "CrossPointe C", sub: "40 seats",   x: 490, y: 314, w: 120, h:  96, reservable: true,  labelSize: "xs" },
];

// ── Upstairs layout ───────────────────────────────────────────────────────────
// viewBox: 0 0 990 410
// Left col (0–345): Gym + Fitness below
// Center-left (345–490): CrossTies Café, Loft, Weight Room, Group Fitness stacked
// Center (490–580): Stair/corridor, Conf Room, Fitness Room
// Right (580–990): CrossTies A/B/C at top, CrossView fills bottom

const UPSTAIRS: Shape[] = [
  // — Non-reservable
  { id: null, label: "Gym",              x:   0, y:   0, w: 345, h: 310, reservable: false, labelSize: "lg" },
  { id: null, label: "Walking Track",    x:   0, y: 310, w: 345, h:  22, reservable: false, labelSize: "xs" },
  { id: null, label: "Fitness Center",   x:   0, y: 332, w: 175, h:  78, reservable: false, labelSize: "xs" },
  { id: null, label: "",                 x: 175, y: 332, w: 170, h:  78, reservable: false },
  { id: null, label: "Weight Room",      x: 345, y: 270, w: 145, h:  80, reservable: false, labelSize: "xs" },
  { id: null, label: "Group Fitness",    x: 345, y: 350, w: 145, h:  60, reservable: false, labelSize: "xs" },
  { id: null, label: "",                 x: 490, y:   0, w:  90, h: 100, reservable: false }, // stairs
  { id: null, label: "Conf. Room",       x: 490, y: 100, w:  90, h: 105, reservable: false, labelSize: "xs" },
  { id: null, label: "Fitness Room",        x: 490, y: 205, w:  90, h: 100, reservable: false, labelSize: "xs" },
  { id: null, label: "",                 x: 490, y: 305, w:  90, h: 105, reservable: false }, // utility
  // — Reservable
  { id: "crosstiescafe", label: "CrossTies Café", sub: "60 seats",  x: 345, y:   0, w: 145, h: 135, reservable: true, labelSize: "sm" },
  { id: "loft",          label: "The Loft",        sub: "100 seats", x: 345, y: 135, w: 145, h: 135, reservable: true, labelSize: "sm" },
  { id: "crosstiesA",    label: "CrossTies A",     sub: "20",        x: 580, y:   0, w: 130, h: 100, reservable: true, labelSize: "xs" },
  { id: "crosstiesB",    label: "CrossTies B",     sub: "20",        x: 710, y:   0, w: 130, h: 100, reservable: true, labelSize: "xs" },
  { id: "crosstiesC",    label: "CrossTies C",     sub: "20",        x: 840, y:   0, w: 150, h: 100, reservable: true, labelSize: "xs" },
  { id: "crossview",     label: "CrossView",       sub: "50 seats",  x: 580, y: 100, w: 410, h: 310, reservable: true, labelSize: "md" },
];

// ── Room lookup ───────────────────────────────────────────────────────────────
const ROOM_MAP = Object.fromEntries(ROOMS.map(r => [r.id, r]));

// ── Font sizes by label variant ───────────────────────────────────────────────
const LABEL_SIZES = { xs: 9, sm: 11, md: 13, lg: 16 } as const;
const SUB_SIZES   = { xs: 7, sm: 8,  md: 10, lg: 12 } as const;

// ── Stair indicator paths (decorative) ───────────────────────────────────────
function StairsIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} opacity="0.3">
      {[0,1,2,3].map(i => (
        <line key={i} x1={i*4} y1={16-i*4} x2={i*4+4} y2={16-i*4}
          stroke="currentColor" strokeWidth="1" />
      ))}
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface FloorPlanProps {
  /** Room IDs that are "active" in the current filter — others are dimmed */
  activeIds?: Set<string>;
  /** Called when user clicks a reservable room */
  onRoomClick?: (room: Room) => void;
  className?: string;
}

export function FloorPlan({ activeIds, onRoomClick, className = "" }: FloorPlanProps) {
  const [floor, setFloor] = useState<"upstairs" | "downstairs">("upstairs");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const shapes = floor === "upstairs" ? UPSTAIRS : DOWNSTAIRS;
  const allActive = !activeIds || activeIds.size === 0;

  const hoveredRoom = hoverId ? ROOM_MAP[hoverId] : null;

  function handleClick(shape: Shape) {
    if (!shape.reservable || !shape.id) return;
    const room = ROOM_MAP[shape.id];
    if (room) onRoomClick?.(room);
  }

  function isActive(shape: Shape): boolean {
    if (!shape.reservable || !shape.id) return false;
    if (allActive) return true;
    return activeIds!.has(shape.id);
  }

  function isDimmed(shape: Shape): boolean {
    if (!shape.reservable || !shape.id) return false;
    if (allActive) return false;
    return !activeIds!.has(shape.id);
  }

  return (
    <div className={`select-none ${className}`}>

      {/* ── Floor tabs ── */}
      <div className="flex gap-2 mb-3">
        {(["upstairs", "downstairs"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFloor(f)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all"
            style={floor === f
              ? { background: "var(--bx-brass)", color: "var(--bx-ink)", boxShadow: "0 0 12px color-mix(in srgb, var(--bx-brass) 35%, transparent)" }
              : { background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-slate)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)" }
            }
          >
            {f === "upstairs" ? "↑ Upstairs" : "↓ Downstairs"}
          </button>
        ))}
      </div>

      {/* ── SVG Floor Plan ── */}
      <div className="relative w-full overflow-x-auto rounded-xl"
        style={{ background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
        <svg
          viewBox="0 0 990 410"
          className="w-full"
          style={{ minWidth: "520px", display: "block" }}
          role="img"
          aria-label={`BX ${floor} floor plan`}
        >
          {/* Building background */}
          <rect x="0" y="0" width="990" height="410"
            style={{ fill: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)" }} />

          {/* Subtle grid */}
          <defs>
            <pattern id="bx-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none"
                style={{ stroke: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)" }} strokeWidth="0.5"/>
            </pattern>
            {/* Glow filter for hovered reservable rooms */}
            <filter id="bx-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <rect x="0" y="0" width="990" height="410" fill="url(#bx-grid)" />

          {/* Building outline */}
          <rect x="0" y="0" width="990" height="410" rx="0" fill="none"
            style={{ stroke: "color-mix(in srgb, var(--bx-parchment) 20%, transparent)" }} strokeWidth="1.5"/>

          {/* ── Room shapes ── */}
          {shapes.map((shape, i) => {
            const active = isActive(shape);
            const dimmed = isDimmed(shape);
            const hovered = shape.id !== null && hoverId === shape.id;
            const size = shape.labelSize ?? "sm";
            const fontSize = LABEL_SIZES[size];
            const subSize = SUB_SIZES[size];
            const cx = shape.x + shape.w / 2;
            const cy = shape.y + shape.h / 2;

            // Color logic
            let fillColor: string;
            let strokeColor: string;
            let textColor: string;
            let opacity = 1;

            if (!shape.reservable) {
              fillColor = "color-mix(in srgb, var(--bx-parchment) 6%, transparent)";
              strokeColor = "color-mix(in srgb, var(--bx-parchment) 12%, transparent)";
              textColor = "color-mix(in srgb, var(--bx-parchment) 30%, transparent)";
            } else if (dimmed) {
              fillColor = "color-mix(in srgb, var(--bx-parchment) 3%, transparent)";
              strokeColor = "color-mix(in srgb, var(--bx-parchment) 7%, transparent)";
              textColor = "color-mix(in srgb, var(--bx-parchment) 15%, transparent)";
              opacity = 0.5;
            } else if (hovered) {
              fillColor = "color-mix(in srgb, var(--bx-brass) 25%, transparent)";
              strokeColor = "var(--bx-brass)";
              textColor = "var(--bx-parchment)";
            } else if (active) {
              fillColor = "color-mix(in srgb, var(--bx-brass) 12%, transparent)";
              strokeColor = "color-mix(in srgb, var(--bx-brass) 55%, transparent)";
              textColor = "var(--bx-parchment)";
            } else {
              // reservable but allActive=false and not dimmed shouldn't happen, fallback
              fillColor = "color-mix(in srgb, var(--bx-brass) 12%, transparent)";
              strokeColor = "color-mix(in srgb, var(--bx-brass) 55%, transparent)";
              textColor = "var(--bx-parchment)";
            }

            return (
              <g key={i} opacity={opacity}
                style={{ cursor: shape.reservable ? "pointer" : "default" }}
                onClick={() => handleClick(shape)}
                onMouseEnter={() => shape.id && shape.reservable && setHoverId(shape.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <rect
                  x={shape.x + 1} y={shape.y + 1}
                  width={shape.w - 2} height={shape.h - 2}
                  rx="2"
                  style={{ fill: fillColor, stroke: strokeColor, strokeWidth: hovered ? 1.5 : 1,
                    transition: "fill 0.15s ease, stroke 0.15s ease" }}
                />

                {/* Brass corner accent for active reservable rooms */}
                {active && !dimmed && (
                  <rect x={shape.x + 1} y={shape.y + 1} width="3" height={shape.h - 2} rx="1"
                    style={{ fill: hovered ? "var(--bx-brass)" : "color-mix(in srgb, var(--bx-brass) 60%, transparent)" }} />
                )}

                {/* Labels — skip blank labels */}
                {shape.label && shape.w > 45 && shape.h > 20 && (
                  <>
                    <text
                      x={cx + (active && !dimmed ? 2 : 0)}
                      y={shape.sub ? cy - subSize * 0.8 : cy}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={fontSize}
                      fontWeight={shape.reservable ? "600" : "400"}
                      fontFamily="system-ui, -apple-system, sans-serif"
                      style={{ fill: textColor, transition: "fill 0.15s ease",
                        pointerEvents: "none", userSelect: "none" }}
                    >
                      {shape.label}
                    </text>
                    {shape.sub && shape.h > 40 && (
                      <text
                        x={cx + (active && !dimmed ? 2 : 0)}
                        y={cy + fontSize * 0.85}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={subSize}
                        fontFamily="system-ui, -apple-system, sans-serif"
                        style={{ fill: "color-mix(in srgb," + textColor + " 65%, transparent)",
                          pointerEvents: "none", userSelect: "none" }}
                      >
                        {shape.sub}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Stair indicators */}
          {floor === "downstairs" && (
            <>
              <text x="340" y="60" textAnchor="middle" fontSize="7" fontFamily="system-ui"
                style={{ fill: "color-mix(in srgb, var(--bx-parchment) 20%, transparent)" }}>
                ↑ stairs
              </text>
              <text x="340" y="140" textAnchor="middle" fontSize="7" fontFamily="system-ui"
                style={{ fill: "color-mix(in srgb, var(--bx-parchment) 20%, transparent)" }}>
                ↑ stairs
              </text>
            </>
          )}
          {floor === "upstairs" && (
            <text x="535" y="55" textAnchor="middle" fontSize="7" fontFamily="system-ui"
              style={{ fill: "color-mix(in srgb, var(--bx-parchment) 20%, transparent)" }}>
              ↕ stairs
            </text>
          )}

          {/* Compass / orientation label */}
          <text x="978" y="400" textAnchor="end" fontSize="8" fontFamily="system-ui"
            style={{ fill: "color-mix(in srgb, var(--bx-parchment) 18%, transparent)" }}>
            BX {floor === "upstairs" ? "Upper" : "Lower"} Level
          </text>
        </svg>
      </div>

      {/* ── Hover info strip ── */}
      <div className="mt-2 h-10 flex items-center px-3 rounded-lg transition-all"
        style={{ background: hoveredRoom
          ? "color-mix(in srgb, var(--bx-brass) 12%, transparent)"
          : "transparent",
          border: hoveredRoom
            ? "1px solid color-mix(in srgb, var(--bx-brass) 25%, transparent)"
            : "1px solid transparent"
        }}>
        {hoveredRoom ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--bx-parchment)" }}>
                {hoveredRoom.name}
              </span>
              <span className="text-xs" style={{ color: "var(--bx-slate)" }}>
                · {hoveredRoom.capacity} seats · {hoveredRoom.floor === "upstairs" ? "Upstairs" : "Downstairs"}
              </span>
            </div>
            <span className="text-xs font-medium" style={{ color: "var(--bx-brass)" }}>
              Click to explore →
            </span>
          </div>
        ) : (
          <span className="text-xs" style={{ color: "var(--bx-slate)" }}>
            Hover a room to preview · Click to explore
          </span>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="mt-2 flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{
            background: "color-mix(in srgb, var(--bx-brass) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--bx-brass) 55%, transparent)"
          }} />
          <span className="text-xs" style={{ color: "var(--bx-slate)" }}>Reservable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{
            background: "color-mix(in srgb, var(--bx-parchment) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)"
          }} />
          <span className="text-xs" style={{ color: "var(--bx-slate)" }}>Non-reservable area</span>
        </div>
      </div>
    </div>
  );
}
