// Event Map · Phase B — share links.
// One row per reservation in reservation_map_shares: a random token that opens
// the event map read-only at /bx-map?event=<token>, no sign-in. Off by default,
// on once the planner (or staff) turns it on, revocable instantly, and the
// token can be rotated so an old link stops working.

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listLabels, reservationDates, reservedMapRoomIds, type EventLayer } from "@/lib/event-map";

export interface ShareRow {
  reservation_id: string;
  token: string;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ShareState {
  enabled: boolean;
  token: string | null;
  path: string | null; // "/bx-map?event=…" — the page adds the origin
}

const newToken = () => randomBytes(16).toString("base64url"); // 22 chars, URL-safe

export const sharePath = (token: string, roomId?: string | null) => `/bx-map?event=${token}${roomId ? `#${roomId}` : ""}`;

export async function getShare(db: SupabaseClient, reservationId: string): Promise<ShareRow | null> {
  const { data } = await db.from("reservation_map_shares").select("*").eq("reservation_id", reservationId).maybeSingle();
  return (data as ShareRow | null) ?? null;
}

export function shareState(row: ShareRow | null): ShareState {
  const on = !!row && row.enabled && !row.revoked_at;
  return { enabled: on, token: on ? row!.token : null, path: on ? sharePath(row!.token) : null };
}

/** Turn sharing on (creating a token the first time). `rotate` issues a fresh token and retires the old link. */
export async function enableShare(db: SupabaseClient, reservationId: string, userId: string, rotate = false): Promise<ShareState> {
  const existing = await getShare(db, reservationId);
  const token = !existing || rotate ? newToken() : existing.token;
  const { data, error } = await db
    .from("reservation_map_shares")
    .upsert(
      { reservation_id: reservationId, token, enabled: true, revoked_at: null, created_by: existing?.created_by ?? userId },
      { onConflict: "reservation_id" }
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't turn sharing on");
  return shareState(data as ShareRow);
}

export async function disableShare(db: SupabaseClient, reservationId: string): Promise<ShareState> {
  const { data, error } = await db
    .from("reservation_map_shares")
    .update({ enabled: false, revoked_at: new Date().toISOString() })
    .eq("reservation_id", reservationId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return shareState((data as ShareRow | null) ?? null);
}

/** The read-only layer behind a public link, or null when the token is unknown, off or revoked. */
export async function resolveShareToken(
  db: SupabaseClient,
  token: string
): Promise<{ layer: EventLayer; reservationId: string } | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { data: share } = await db
    .from("reservation_map_shares")
    .select("reservation_id, enabled, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!share || !share.enabled || share.revoked_at) return null;
  const { data: r } = await db
    .from("reservations")
    .select("id, event_name, status, payload, logo_status, logo_path")
    .eq("id", share.reservation_id as string)
    .maybeSingle();
  if (!r || r.status === "cancelled") return null;
  const labels = await listLabels(db, r.id as string, false); // never staff notes on a public link
  let logoUrl: string | null = null;
  if (r.logo_status === "approved" && r.logo_path) {
    const { data } = await db.storage.from("event-logos").createSignedUrl(r.logo_path as string, 3600);
    logoUrl = data?.signedUrl ?? null;
  }
  return {
    reservationId: r.id as string,
    layer: {
      id: r.id as string,
      name: r.event_name as string,
      dates: reservationDates(r.payload),
      mode: "view",
      staff: false,
      rooms: reservedMapRoomIds(r.payload),
      labels,
      logoUrl,
      public: true,
    },
  };
}
