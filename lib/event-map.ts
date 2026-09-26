/**
 * BX Reservations — Event Map
 *
 * A planner's own room names, setups and notes laid over the BX building
 * map for one reservation. Shared vocabulary, room-id mapping, validation
 * and the server-side data access used by /api/event-map.
 *
 * Design: Brainerd HQ › claude/bx-map-event-layer-design-2026-09-26.md
 * Map runtime: app/bx-map/map-bundle.ts (window.BXMap) — the page keeps
 * day_index `null` for "every day"; the database stores that as -1.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { ROOMS } from "./rooms";

// ----------------------------------------------------------------
// Vocabulary (mirrored in map-script.js — keep the two lists identical)
// ----------------------------------------------------------------

export const SETUP_STYLES = [
  "theater",
  "classroom",
  "rounds_8",
  "rounds_10",
  "ushape",
  "boardroom",
  "open",
  "stations",
  "asis",
] as const;
export type SetupStyle = (typeof SETUP_STYLES)[number];

export const SETUP_LABELS: Record<SetupStyle, string> = {
  theater: "Theater",
  classroom: "Classroom",
  rounds_8: "Rounds of 8",
  rounds_10: "Rounds of 10",
  ushape: "U-shape",
  boardroom: "Boardroom",
  open: "Open floor",
  stations: "Stations",
  asis: "As-is",
};

/** What BX stocks — drives the count fields on each room. */
export const TABLE_STOCK = [
  { key: "tables_6ft", label: "6 ft tables" },
  { key: "tables_8ft", label: "8 ft tables" },
  { key: "tables_round", label: '60" rounds' },
] as const;

export const EVENT_NAME_MAX = 24;
export const NOTES_MAX = 500;
export const COUNT_MAX = 999;

/** Every-day marker in the database (the map page uses null). */
export const ALL_DAYS = -1;

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** A label as the map page sees it (day_index null = every day). */
export interface MapLabel {
  room_id: string;
  day_index: number | null;
  event_name: string | null;
  setup_style: SetupStyle | null;
  chairs: number;
  tables_6ft: number;
  tables_8ft: number;
  tables_round: number;
  notes: string | null;
  /** Present only for staff callers. */
  staff_notes?: string | null;
}

/** A row in reservation_map_labels. */
export interface MapLabelRow extends Omit<MapLabel, "day_index" | "staff_notes"> {
  id?: string;
  reservation_id: string;
  level: "lower" | "upper";
  day_index: number; // -1 = every day
  staff_notes: string | null;
  updated_by?: string | null;
  updated_at?: string;
}

export type EventMapChange =
  | { type: "upsert"; row: MapLabel }
  | { type: "delete"; room_id: string; day_index: number | null };

export type EventMapAccess = "edit" | "view";

/** The payload the map page's BXMap.setEvent() takes. */
export interface EventLayer {
  id: string;
  name: string;
  dates: string[]; // ISO yyyy-mm-dd, in order
  mode: EventMapAccess;
  staff: boolean;
  rooms: string[]; // reserved map room ids
  labels: MapLabel[];
  logoUrl?: string | null;
}

// ----------------------------------------------------------------
// Rooms: reservation catalogue id → map room ids
// ----------------------------------------------------------------

/**
 * A reserved catalogue room lights up these map rooms (the main room plus
 * the sub-spaces a planner might name: stage, balcony). Ids are the map's
 * stable ids from bx-map-data.json.
 */
export const RESERVATION_ROOM_TO_MAP: Record<string, string[]> = {
  crossing: ["l-crossing", "l-stage", "l-balcony"],
  loft: ["u-loft"],
  crossview: ["u-crossview"],
  "crosspointe-a": ["l-cp-a"],
  "crosspointe-b": ["l-cp-b"],
  "crosspointe-c": ["l-cp-c"],
  crosstiescafe: ["u-ct-cafe"],
  crosstiesA: ["u-ct-a"],
  crosstiesB: ["u-ct-b"],
  crosstiesC: ["u-ct-c"],
};

export function levelOf(roomId: string): "lower" | "upper" | null {
  if (roomId.startsWith("l-")) return "lower";
  if (roomId.startsWith("u-")) return "upper";
  return null;
}

/** Loose shape of reservations.payload as the reserve form writes it. */
interface PayloadDay {
  date?: string;
  included?: boolean;
  rooms?: { roomId?: string; requested?: boolean }[];
}
interface Payload {
  days?: PayloadDay[];
}

/** Dates of the event, in order (only included days). */
export function reservationDates(payload: unknown): string[] {
  const days = ((payload as Payload | null)?.days ?? []).filter(
    (d) => d && d.date && d.included !== false
  );
  return [...new Set(days.map((d) => String(d.date)))].sort();
}

/** Map room ids covered by the reservation. */
export function reservedMapRoomIds(payload: unknown): string[] {
  const out = new Set<string>();
  for (const day of (payload as Payload | null)?.days ?? []) {
    if (!day || day.included === false) continue;
    for (const r of day.rooms ?? []) {
      if (!r?.roomId) continue;
      for (const id of RESERVATION_ROOM_TO_MAP[r.roomId] ?? []) out.add(id);
    }
  }
  return [...out];
}

/** Catalogue room names for display (e.g. legend headers). */
export function catalogueRoomName(roomId: string): string {
  return ROOMS.find((r) => r.id === roomId)?.name ?? roomId;
}

// ----------------------------------------------------------------
// Validation
// ----------------------------------------------------------------

const clampInt = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(COUNT_MAX, Math.round(n)));
};
const cleanText = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim().slice(0, max);
  return s.length ? s : null;
};

/**
 * Normalise a label coming from the client. Returns null when the room id
 * is not on the map. staff_notes are kept only for staff callers.
 */
export function sanitizeLabel(
  input: Partial<MapLabel> & { room_id?: string },
  opts: { staff: boolean; dayCount: number; knownRoomIds: Set<string> }
): MapLabel | null {
  const room_id = String(input.room_id ?? "");
  if (!opts.knownRoomIds.has(room_id)) return null;
  let day_index: number | null = null;
  if (input.day_index !== null && input.day_index !== undefined) {
    const d = clampInt(input.day_index);
    if (d >= opts.dayCount) return null;
    day_index = d;
  }
  const setup_style = (SETUP_STYLES as readonly string[]).includes(String(input.setup_style))
    ? (input.setup_style as SetupStyle)
    : null;
  const label: MapLabel = {
    room_id,
    day_index,
    event_name: cleanText(input.event_name, EVENT_NAME_MAX),
    setup_style,
    chairs: clampInt(input.chairs),
    tables_6ft: clampInt(input.tables_6ft),
    tables_8ft: clampInt(input.tables_8ft),
    tables_round: clampInt(input.tables_round),
    notes: cleanText(input.notes, NOTES_MAX),
  };
  if (opts.staff) label.staff_notes = cleanText(input.staff_notes, NOTES_MAX);
  return label;
}

export function isEmptyLabel(l: MapLabel): boolean {
  return (
    !l.event_name &&
    !l.setup_style &&
    !l.notes &&
    !l.staff_notes &&
    !l.chairs &&
    !l.tables_6ft &&
    !l.tables_8ft &&
    !l.tables_round
  );
}

// ----------------------------------------------------------------
// Row <-> label
// ----------------------------------------------------------------

export function rowToLabel(row: MapLabelRow, staff: boolean): MapLabel {
  const label: MapLabel = {
    room_id: row.room_id,
    day_index: row.day_index < 0 ? null : row.day_index,
    event_name: row.event_name,
    setup_style: row.setup_style,
    chairs: row.chairs ?? 0,
    tables_6ft: row.tables_6ft ?? 0,
    tables_8ft: row.tables_8ft ?? 0,
    tables_round: row.tables_round ?? 0,
    notes: row.notes,
  };
  if (staff) label.staff_notes = row.staff_notes;
  return label;
}

// ----------------------------------------------------------------
// Server-side access (service-role client; never import in "use client")
// ----------------------------------------------------------------

export interface ReservationForMap {
  id: string;
  booking_number: string | null;
  event_name: string;
  status: string;
  user_id: string | null;
  contact_email: string;
  payload: unknown;
  logo_status?: string | null;
  logo_path?: string | null;
}

export interface EventMapContext {
  reservation: ReservationForMap;
  access: EventMapAccess;
  staff: boolean;
}

export function adminClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Staff = any admin-class role, in either role vocabulary the app has used. */
export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && ["admin", "owner", "system_admin", "booking_admin"].includes(role);
}

/**
 * Resolve what `user` may do with `reservationId`'s event map.
 * Mirrors the SQL helpers in 20260926_event_map.sql:
 *   edit — staff, the reservation's user, its contact email, or an accepted co-owner
 *   view — any other accepted collaborator
 */
export async function getEventMapContext(
  db: SupabaseClient,
  user: { id: string; email?: string | null },
  reservationId: string
): Promise<EventMapContext | null> {
  const { data: reservation, error } = await db
    .from("reservations")
    .select("id, booking_number, event_name, status, user_id, contact_email, payload, logo_status, logo_path")
    .eq("id", reservationId)
    .maybeSingle();
  if (error || !reservation) return null;

  const [{ data: roleRow }, { data: collab }] = await Promise.all([
    db.from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    db
      .from("reservation_collaborators")
      .select("collab_role")
      .eq("reservation_id", reservationId)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .maybeSingle(),
  ]);

  const staff = isStaffRole(roleRow?.role as string | undefined);
  const email = (user.email ?? "").toLowerCase();
  const owns =
    (reservation.user_id !== null && reservation.user_id === user.id) ||
    (!!email && String(reservation.contact_email ?? "").toLowerCase() === email);
  const coOwner = collab?.collab_role === "co_owner";

  let access: EventMapAccess | null = null;
  if (staff || owns || coOwner) access = "edit";
  else if (collab) access = "view";
  if (!access) return null;

  return { reservation: reservation as ReservationForMap, access, staff };
}

/** All labels for a reservation, in the page's shape. */
export async function listLabels(
  db: SupabaseClient,
  reservationId: string,
  staff: boolean
): Promise<MapLabel[]> {
  const { data, error } = await db
    .from("reservation_map_labels")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("room_id")
    .order("day_index");
  if (error || !data) return [];
  return (data as MapLabelRow[]).map((r) => rowToLabel(r, staff));
}

/** Build the layer the map page mounts with. */
export async function buildEventLayer(
  db: SupabaseClient,
  ctx: EventMapContext
): Promise<EventLayer> {
  const labels = await listLabels(db, ctx.reservation.id, ctx.staff);
  return {
    id: ctx.reservation.id,
    name: ctx.reservation.event_name,
    dates: reservationDates(ctx.reservation.payload),
    mode: ctx.access,
    staff: ctx.staff,
    rooms: reservedMapRoomIds(ctx.reservation.payload),
    labels,
    logoUrl: null, // Phase B: signed URL once the logo is approved
  };
}

/**
 * Apply a batch of changes from the page. Each change is validated and
 * applied independently; the result reports what landed.
 */
export async function applyChanges(
  db: SupabaseClient,
  ctx: EventMapContext,
  changes: EventMapChange[],
  userId: string,
  knownRoomIds: Set<string>
): Promise<{ applied: number; rejected: number }> {
  const dayCount = Math.max(1, reservationDates(ctx.reservation.payload).length);
  let applied = 0;
  let rejected = 0;

  for (const change of changes) {
    if (!change || typeof change !== "object") {
      rejected++;
      continue;
    }
    if (change.type === "delete") {
      const room_id = String(change.room_id ?? "");
      if (!knownRoomIds.has(room_id)) {
        rejected++;
        continue;
      }
      const day =
        change.day_index === null || change.day_index === undefined
          ? ALL_DAYS
          : clampInt(change.day_index);
      const { error } = await db
        .from("reservation_map_labels")
        .delete()
        .eq("reservation_id", ctx.reservation.id)
        .eq("room_id", room_id)
        .eq("day_index", day);
      if (error) rejected++;
      else applied++;
      continue;
    }
    if (change.type === "upsert") {
      const label = sanitizeLabel(change.row ?? {}, { staff: ctx.staff, dayCount, knownRoomIds });
      if (!label) {
        rejected++;
        continue;
      }
      const level = levelOf(label.room_id);
      if (!level) {
        rejected++;
        continue;
      }
      const day = label.day_index === null ? ALL_DAYS : label.day_index;
      if (isEmptyLabel(label)) {
        const { error } = await db
          .from("reservation_map_labels")
          .delete()
          .eq("reservation_id", ctx.reservation.id)
          .eq("room_id", label.room_id)
          .eq("day_index", day);
        if (error) rejected++;
        else applied++;
        continue;
      }
      const row: Record<string, unknown> = {
        reservation_id: ctx.reservation.id,
        room_id: label.room_id,
        level,
        day_index: day,
        event_name: label.event_name,
        setup_style: label.setup_style,
        chairs: label.chairs,
        tables_6ft: label.tables_6ft,
        tables_8ft: label.tables_8ft,
        tables_round: label.tables_round,
        notes: label.notes,
        updated_by: userId,
      };
      if (ctx.staff) row.staff_notes = label.staff_notes ?? null; // non-staff writes leave staff notes untouched
      const { error } = await db
        .from("reservation_map_labels")
        .upsert(row, { onConflict: "reservation_id,room_id,day_index" });
      if (error) rejected++;
      else applied++;
      continue;
    }
    rejected++;
  }
  return { applied, rejected };
}
