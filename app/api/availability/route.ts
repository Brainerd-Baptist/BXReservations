import { NextRequest, NextResponse } from "next/server";

// --- Room -> PCO Resource ID mapping -----------------------------------------
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

// --- PCO EventResourceRequest approval_status -> availability signal ----------
// approval_status on EventResourceRequest: approved | pending | rejected
type Signal = "available" | "ask" | "unavailable";
const STATUS_SIGNAL: Record<string, Signal> = {
  approved: "unavailable",
  pending: "ask",
  rejected: "available",
};

// --- PCO API helper -----------------------------------------------------------
// PCO uses PHP-style bracket params (where[field][op]).
// URLSearchParams encodes brackets as %5B%5D which PCO ignores, so we build
// the query string manually to keep raw brackets in keys.
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
    throw new Error(`PCO ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

// --- Types -------------------------------------------------------------------

interface PcoBooking {
  id: string;
  relationships?: {
    event_resource_request?: { data?: { id: string } };
  };
}
interface PcoEventResourceRequest {
  id: string;
  type: string;
  attributes: {
    approval_status?: string;
  };
}
interface PcoBookingsData {
  data: PcoBooking[];
  included?: PcoEventResourceRequest[];
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
        // include=event_resource_request is the only PCO-supported include on
        // resource_bookings (besides "resource"). Its approval_status is the
        // direct signal -- no second event fetch needed.
        const bookingsData = (await pcoGet("/resource_bookings", {
          "where[resource_id]": String(resourceId),
          "where[starts_at][lte]": endOfDay,
          "where[ends_at][gte]": startOfDay,
          include: "event_resource_request",
          per_page: "25",
        })) as PcoBookingsData;

        const bookings = bookingsData.data ?? [];

        if (bookings.length === 0) {
          result[roomId] = "available";
          return;
        }

        // Build map: event_resource_request_id -> approval_status
        const requestStatus = new Map<string, string>();
        for (const inc of bookingsData.included ?? []) {
          if (inc.type === "EventResourceRequest") {
            const status = inc.attributes?.approval_status;
            if (status) requestStatus.set(inc.id, status);
          }
        }

        // Priority: approved -> unavailable | all rejected -> available | else -> ask
        let hasApproved = false;
        let allRejected = bookings.length > 0;

        for (const booking of bookings) {
          const reqId = booking.relationships?.event_resource_request?.data?.id;
          if (!reqId) {
            allRejected = false; // booking with no request -- treat as pending
            continue;
          }

          const status = requestStatus.get(reqId) ?? "pending";
          const signal = STATUS_SIGNAL[status] ?? "ask";

          if (signal === "unavailable") {
            hasApproved = true;
            break;
          }
          if (signal !== "available") {
            allRejected = false;
          }
        }

        if (hasApproved) result[roomId] = "unavailable";
        else if (allRejected) result[roomId] = "available";
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
