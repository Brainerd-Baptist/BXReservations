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

// ─── PCO "Event Status" tag → availability signal ─────────────────────────────
const TAG_SIGNAL: Record<string, "available" | "ask" | "unavailable"> = {
  Confirmed: "unavailable",
  "Pending | Hold": "ask",
  Placeholder: "ask",
  Canceled: "available",
};

// ─── PCO API helper ────────────────────────────────────────────────────────────
async function pcoGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const appId = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;
  if (!appId || !secret) throw new Error("PCO_APP_ID / PCO_SECRET not configured");
  const auth = Buffer.from(`${appId}:${secret}`).toString("base64");

  const url = new URL(`https://api.planningcenteronline.com/calendar/v2${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PCO ${res.status}: ${text}`);
  }
  return res.json();
}

type Signal = "available" | "ask" | "unavailable";

interface PcoBooking {
  id: string;
  relationships?: {
    event?: { data?: { id: string } };
  };
}
interface PcoData {
  data: PcoBooking[];
}
interface PcoTagData {
  data: Array<{ attributes: { name: string } }>;
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
        // Use URLSearchParams-style object so brackets are properly encoded
        const data = (await pcoGet("/resource_bookings", {
          "where[resource_id]": String(resourceId),
          "where[starts_at][lte]": endOfDay,
          "where[ends_at][gte]": startOfDay,
          "per_page": "25",
        })) as PcoData;

        const bookings = data.data ?? [];

        if (bookings.length === 0) {
          result[roomId] = "available";
          return;
        }

        let signal: Signal = "ask";

        for (const booking of bookings) {
          const eventId = booking.relationships?.event?.data?.id;
          if (!eventId) continue;

          const tagsData = (await pcoGet(`/events/${eventId}/tags`)) as PcoTagData;
          const tagNames = (tagsData.data ?? []).map((t) => t.attributes.name);

          for (const tag of tagNames) {
            const mapped = TAG_SIGNAL[tag];
            if (mapped === "unavailable") {
              signal = "unavailable";
              break;
            }
            if (mapped === "available") {
              signal = "available";
            }
          }

          if (signal === "unavailable") break;
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
