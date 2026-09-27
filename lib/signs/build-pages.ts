// Turns a reservation's event map into the list of sign pages to print.
//
// Room pages: every reserved catalogue room's main map room always gets a
// sign; reserved sub-spaces (stage, balcony) get one only when the planner
// named or set them up. Wayfinding pages: every note the planner put on a
// room outside the reservation ("Check-in here →", "Coats").
// Staff copies add the setup line, crew notes and staff notes; when a room
// varies by day, staff get one page per day.

import { MAP_ROOMS } from "@/app/bx-map/map-bundle";
import {
  RESERVATION_ROOM_TO_MAP,
  SETUP_LABELS,
  reservationDates,
  reservedMapRoomIds,
  type MapLabel,
} from "@/lib/event-map";
import type { SignPage, SignVariant } from "./door-signs";

interface PayloadDay { included?: boolean; rooms?: { roomId?: string }[] }

export function setupLine(l: MapLabel | undefined | null): string | null {
  if (!l || !l.setup_style) return null;
  const parts: string[] = [SETUP_LABELS[l.setup_style] ?? l.setup_style];
  if (l.chairs) parts.push(`${l.chairs} chairs`);
  const t: string[] = [];
  if (l.tables_6ft) t.push(`${l.tables_6ft} × 6 ft`);
  if (l.tables_8ft) t.push(`${l.tables_8ft} × 8 ft`);
  if (l.tables_round) t.push(`${l.tables_round} × 60" round`);
  if (t.length) parts.push(t.join(", "));
  return parts.join(" · ");
}

const planned = (l: MapLabel | undefined) => !!(l && (l.event_name || l.setup_style || l.notes));

/** The main map room of every reserved catalogue room (The Crossing itself, not its stage or balcony). */
export function mainMapRooms(payload: unknown): Set<string> {
  const main = new Set<string>();
  for (const d of ((payload as { days?: PayloadDay[] } | null)?.days ?? [])) {
    if (!d || d.included === false) continue;
    for (const r of d.rooms ?? []) {
      const ids = RESERVATION_ROOM_TO_MAP[r?.roomId ?? ""];
      if (ids?.length) main.add(ids[0]);
    }
  }
  return main;
}

/** The label in force for a room on a given day (names/notes from the whole-event row, setup from the day row when present). */
function labelFor(labels: MapLabel[], roomId: string, day: number | null): MapLabel | undefined {
  const base = labels.find((l) => l.room_id === roomId && l.day_index === null);
  const own = day === null ? undefined : labels.find((l) => l.room_id === roomId && l.day_index === day);
  if (!base && !own) return undefined;
  if (!own) return base;
  return { ...(base ?? own), setup_style: own.setup_style, chairs: own.chairs, tables_6ft: own.tables_6ft, tables_8ft: own.tables_8ft, tables_round: own.tables_round };
}

export function buildSignPages(opts: {
  payload: unknown;
  labels: MapLabel[];
  variant: SignVariant;
  onlyRoom?: string | null;
  onlyDay?: number | null;
}): SignPage[] {
  const { payload, labels, variant } = opts;
  const reserved = new Set(reservedMapRoomIds(payload));
  const dates = reservationDates(payload);
  const main = mainMapRooms(payload);
  const dayLabel = (i: number) => {
    const [y, m, d] = (dates[i] ?? "").split("-").map(Number);
    return dates[i] ? new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : `Day ${i + 1}`;
  };

  const pages: SignPage[] = [];
  for (const room of MAP_ROOMS) {
    if (opts.onlyRoom && room.id !== opts.onlyRoom) continue;
    const base = labels.find((l) => l.room_id === room.id && l.day_index === null);
    const isReserved = reserved.has(room.id);

    if (isReserved) {
      if (!main.has(room.id) && !planned(base)) continue;
      const title = base?.event_name?.trim() || room.name;
      if (variant === "public") {
        pages.push({ kind: "room", roomId: room.id, level: room.level, realName: room.name, title });
        continue;
      }
      // a room that varies by day gets one staff page per event day (days without their own row fall back to the whole-event setup)
      const varies = dates.length > 1 && labels.some((l) => l.room_id === room.id && l.day_index !== null);
      const days: (number | null)[] = varies ? dates.map((_, i) => i) : [null];
      for (const day of days) {
        if (opts.onlyDay !== null && opts.onlyDay !== undefined && day !== null && day !== opts.onlyDay) continue;
        const l = labelFor(labels, room.id, day);
        pages.push({
          kind: "room",
          roomId: room.id,
          level: room.level,
          realName: room.name,
          title,
          dayLabel: day === null ? (dates.length > 1 ? "Every day" : null) : dayLabel(day),
          setupLine: setupLine(l),
          notes: l?.notes ?? null,
          staffNotes: l?.staff_notes ?? null,
        });
      }
    } else if (base?.event_name?.trim()) {
      // a wayfinding note on a hallway, lobby, door…
      pages.push({
        kind: "wayfinding",
        roomId: room.id,
        level: room.level,
        realName: room.name,
        title: base.event_name.trim(),
        notes: variant === "staff" ? base.notes : null,
        staffNotes: variant === "staff" ? base.staff_notes ?? null : null,
      });
    }
  }
  // door signs first, in map order; wayfinding pages after
  return [...pages.filter((p) => p.kind === "room"), ...pages.filter((p) => p.kind === "wayfinding")];
}

export function signsFilename(eventName: string, variant: SignVariant, onlyRoom?: string | null): string {
  const slug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "event";
  const room = onlyRoom ? `-${onlyRoom.replace(/^[lu]-/, "")}` : "";
  return `${slug}-door-signs${room}${variant === "staff" ? "-staff" : ""}.pdf`;
}
