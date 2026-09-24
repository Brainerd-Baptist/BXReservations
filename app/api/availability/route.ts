import { NextRequest, NextResponse } from "next/server";

// ─── Room → PCO Resource ID mapping ──────────────────────────────────────────
const ROOM_RESOURCE_IDS: Record<string, number> = {
  crossing: 355074,
  loft: 355075,
  "crosspointe-a": 355076,
  "crosspointe-b": 355077,
  "crosspointe-c": 355078,
  crossview: 355059,
  crosstiesA: 355079,
  crosstiesB: 355080,
  crosstiesC: 355081,
  crosstiescafe: 369502,
};

// ─── PCO Event approval_status → availability signal ─────────────────────────
// PCO Calendar approval_status values: draft, pending, tentative, confirmed, cancelled
type Signal = "available" | "ask" | "unavailable";

// ─── PCO API helper ────────────────────────────────────────────────────────────
// NOTE: PCO uses PHP-style bracket notation in query params (e.g. where[field][op]).
// URLSearchParams encodes brackets as %5B%5D, which PCO ignores.
// We build the query string manually to keep raw brackets in keys.
async function pcoGet(
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const appId = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;
  if (!appId || !secret) throw new Error("PCO_APP_ID / PCO_SECRET not configured");
  const auth = Buffer.from(`${appId}:${secret}`).toString("base64");

  const base = `https://api.planningcenteronline.com/calendar/v2${path}`;
  const queryString = params
    ? Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  const fullUrl = queryString ? `${base}?${queryString}` : base;

  const res = await fetch(fullUrl, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PCO ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PcoBooking {
  id: string;
  relationships?: {
    // ResourceBooking → event_instance (NOT event directly)
    event_instance?: { data?: { id: string } };
  };
}
interface PcoEventInstance {
  id: string;
  type: string;
  relationships?: {
    event?: { data?: { id: string } };
  };
}
interface PcoEvent {
  data: {
    attributes: {
      approval_status?: string;
    };
  };
}
interface PcoBookingsData {
  data: PcoBooking[];
  included?: PcoEventInstance[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const roomParam = searchParams.get("rooms");

  if (!date) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  const rooms = roomParam
    ? roomParam.split(",").map((r) => r.trim())
    : Object.keys(ROOM_RESOURCE_IDS);

  // Overlap window: booking starts before end-of-day AND ends after start-of-day
  const startOfDay = `${date}T00:00:00Z`;
  const endOfDay = `${date}T23:59:59Z`;

  const result: Record<string, Signal> = {};

  await Promise.all(
    rooms.map(async (roomId) => {
      const resourceId = ROOM_RESOURCE_IDS[roomId];
      if (!resourceId) {
        result[roomId] = "available";
        return;
      }

      try {
        // Fetch resource bookings that overlap the requested day.
        // PCO relationship chain: ResourceBooking → event_instance → event
        // include=event_instance brings EventInstance records into `included`,
        // each of which carries a relationships.event.data.id we can use to
        // fetch the parent Event and read its approval_status.
        const bookingsData = (await pcoGet("/resource_bookings", {
          "where[resource_id]": String(resourceId),
          "where[starts_at][lte]": endOfDay,
          "where[ends_at][gte]": startOfDay,
          include: "event_instance",
          per_page: "25",
        })) as PcoBookingsData;

        const bookings = bookingsData.data ?? [];

        if (bookings.length === 0) {
          result[roomId] = "available";
          return;
        }

        // Build map: event_instance_id → event_id
        const instanceToEventId = new Map<string, string>();
        for (const inc of bookingsData.included ?? []) {
          if (inc.type === "EventInstance") {
            const eventId = inc.relationships?.event?.data?.id;
            if (eventId) instanceToEventId.set(inc.id, eventId);
          }
        }

        // Collect unique event IDs from this room's bookings
        const eventIds = new Set<string>();
        for (const booking of bookings) {
          const instanceId = booking.relationships?.event_instance?.data?.id;
          if (instanceId) {
            const eventId = instanceToEventId.get(instanceId);
            if (eventId) eventIds.add(eventId);
          }
        }

        // Fetch approval_status for each unique event (usually 1–3 per room/day)
        const eventStatuses = new Map<string, string>();
        await Promise.all(
          Array.from(eventIds).map(async (eventId) => {
            const ev = (await pcoGet(`/events/${eventId}`)) as PcoEvent;
            eventStatuses.set(eventId, ev.data?.attributes?.approval_status ?? "pending");
          })
        );

        // Determine signal with correct priority:
        //   confirmed → unavailable (trumps everything)
        //   all cancelled → available
        //   otherwise (pending/tentative/draft/unknown) → ask
        let hasConfirmed = false;
        let allCancelled = bookings.length > 0;

        for (const booking of bookings) {
          const instanceId = booking.relationships?.event_instance?.data?.id;
          if (!instanceId) {
            // Booking with no event_instance — treat as pending / unknown
            allCancelled = false;
            continue;
          }

          const eventId = instanceToEventId.get(instanceId);
          if (!eventId) {
            allCancelled = false;
            continue;
          }

          const status = eventStatuses.get(eventId) ?? "pending";

          if (status === "confirmed") {
            hasConfirmed = true;
            break; // confirmed beats everything
          }
          if (status !== "cancelled") {
            allCancelled = false;
          }
        }

        if (hasConfirmed) result[roomId] = "unavailable";
        else if (allCancelled) result[roomId] = "available";
        else result[roomId] = "ask";
      } catch (err) {
        console.error(`[availability] Room ${roomId}:`, err);
        result[roomId] = "ask";
      }
    })
  );

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
