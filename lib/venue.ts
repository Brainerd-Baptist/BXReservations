// Venue facts attendees are told: name, address, directions link, parking, arrival notes, contact.
// Stored in bx_settings (admin → Settings → Venue info). Empty values are omitted wherever they'd show.

import type { SupabaseClient } from "@supabase/supabase-js";

export const VENUE_KEYS = ["venue_name", "venue_address", "venue_maps_url", "venue_parking", "venue_arrival", "venue_contact"] as const;
export type VenueKey = (typeof VENUE_KEYS)[number];
export type VenueInfo = Record<VenueKey, string>;

export const VENUE_FIELDS: { key: VenueKey; label: string; hint: string; multiline?: boolean }[] = [
  { key: "venue_name", label: "Venue name", hint: "As attendees should see it, e.g. The BX at Brainerd Baptist Church" },
  { key: "venue_address", label: "Street address", hint: "Street, city, state, ZIP — printed on the packet cover and the Getting here page" },
  { key: "venue_maps_url", label: "Directions link", hint: "A Google or Apple Maps link; becomes a QR on the Getting here page" },
  { key: "venue_parking", label: "Parking", hint: "Where attendees should park and which doors to use, in plain words", multiline: true },
  { key: "venue_arrival", label: "When you arrive", hint: "Check-in, accessibility (elevator at the Green Lot entrance), anything else worth knowing", multiline: true },
  { key: "venue_contact", label: "Day-of contact", hint: "Optional: a phone or email attendees may use on the day (leave blank to omit)" },
];

export const VENUE_DEFAULTS: VenueInfo = {
  venue_name: "The BX at Brainerd Baptist Church",
  venue_address: "",
  venue_maps_url: "",
  venue_parking: "",
  venue_arrival: "",
  venue_contact: "",
};

export async function readVenue(db: SupabaseClient): Promise<VenueInfo> {
  const { data } = await db.from("bx_settings").select("key, value").in("key", [...VENUE_KEYS]);
  const out: VenueInfo = { ...VENUE_DEFAULTS };
  for (const row of data ?? []) {
    const k = row.key as VenueKey;
    if (VENUE_KEYS.includes(k)) out[k] = String(row.value ?? "").trim();
  }
  if (!out.venue_name) out.venue_name = VENUE_DEFAULTS.venue_name;
  return out;
}
