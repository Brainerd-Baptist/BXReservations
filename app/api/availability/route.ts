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
const STATUS_SIGNAL: Record<string, Signal> = {
  confirmed: "unavailable",
  tentative: "ask",
  pending: "ask",
  draft: "ask",
  cancelled: "available",
};

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

interface PcoBooking {
  id: string;
  relationships?: {
    event?: { data?: { id: string } };
  };
}
interface PcoEvent {
  id: string;
  type: string;
  attributes: {
    approval_status?: string;
  };
}
interface PcoData {
  data: PcoBooking[];
  included?: PcoEvent[];
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
        // Fetch bookings for this room that overlap the requested day.
        // include=event pulls the event record inline so we can read approval_status
        // without a separate API call per booking.
        const data = (await pcoGet("/resource_bookings", {
          "where[resource_id]": String(resourceId),
          "where[starts_at][lte]": endOfDay,
          "where[ends_at][gte]": startOfDay,
          include: "event",
          per_page: "25",
        })) as PcoData;

        const bookings = data.data ?? [];

        if (bookings.length === 0) {
          result[roomId] = "available";
          return;
        }

        // Build a lookup from event id → event record (included sideloads)
        const eventsById = new Map<string, PcoEvent>();
        for (const inc of data.included ?? []) {
          if (inc.type === "Event") eventsById.set(inc.id, inc);
        }

        let signal: Signal = "ask";

        for (const booking of bookings) {
          const eventId = booking.relationships?.event?.data?.id;
          if (!eventId) continue;

          const event = eventsById.get(eventId);
          const status = event?.attributes?.approval_status ?? "pending";
          const mapped: Signal = STATUS_SIGNAL[status] ?? "ask";

          if (mapped === "unavailable") {
            signal = "unavailable";
            break;
          }
          if (mapped === "available") {
            signal = "available";
          }
        }

        result[roomId] = signal;
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
