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

// ─── PCO EventResourceRequest approval_status → availability signal ───────────
type Signal = "available" | "ask" | "unavailable";
const STATUS_SIGNAL: Record<string, Signal> = {
  approved: "unavailable", A: "unavailable",
  pending:  "ask",         P: "ask",
  rejected: "available",   R: "available",
};

// ─── ET timezone helpers ──────────────────────────────────────────────────────
// Returns UTC offset in hours (positive = hours behind UTC) for Eastern Time on a given date.
// EDT (UTC-4) runs 2nd Sunday in March → 1st Sunday in November; EST (UTC-5) otherwise.
function etUtcOffsetHours(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const yr = d.getUTCFullYear();
  const mar1 = new Date(Date.UTC(yr, 2, 1));
  const dstStart = new Date(Date.UTC(yr, 2, 1 + ((7 - mar1.getUTCDay()) % 7) + 7));
  const nov1 = new Date(Date.UTC(yr, 10, 1));
  const dstEnd = new Date(Date.UTC(yr, 10, 1 + ((7 - nov1.getUTCDay()) % 7)));
  return d >= dstStart && d < dstEnd ? 4 : 5; // EDT=UTC-4, EST=UTC-5
}

// Convert a local ET hour (0–24) on a given date to a UTC ISO string.
function etToUtc(dateStr: string, hourET: number, offsetH: number): string {
  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCMinutes(base.getUTCMinutes() + hourET * 60 + offsetH * 60);
  return base.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Time-of-day slot → [startHourET, endHourET]
type TimeSlot = "any" | "morning" | "afternoon" | "evening";
const SLOT_HOURS: Record<TimeSlot, [number, number]> = {
  any:       [0,  24],
  morning:   [8,  12],
  afternoon: [12, 17],
  evening:   [17, 22],
};

// ─── PCO API helper ────────────────────────────────────────────────────────────
async function pcoGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const appId = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;
  if (!appId || !secret) throw new Error("PCO_APP_ID / PCO_SECRET not configured");
  const auth = Buffer.from(`${appId}:${secret}`).toString("base64");
  const base = `https://api.planningcenteronline.com/calendar/v2${path}`;
  const queryString = params
    ? Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface PcoBooking {
  id: string;
  relationships?: { event_resource_request?: { data?: { id: string } } };
}
interface PcoEventResourceRequest {
  id: string; type: string;
  attributes: { approval_status?: string };
}
interface PcoBookingsData {
  data: PcoBooking[];
  included?: PcoEventResourceRequest[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const timeSlotParam = (searchParams.get("timeSlot") ?? "any") as TimeSlot;
  const roomParam = searchParams.get("rooms");

  if (!date) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  const rooms = roomParam
    ? roomParam.split(",").map(r => r.trim())
    : Object.keys(ROOM_RESOURCE_IDS);

  const slot: TimeSlot = SLOT_HOURS[timeSlotParam] ? timeSlotParam : "any";
  const [startHour, endHour] = SLOT_HOURS[slot];
  const offset = etUtcOffsetHours(date);

  // Query PCO for bookings that overlap the requested ET time window
  const slotStartUtc = etToUtc(date, startHour, offset);
  const slotEndUtc   = etToUtc(date, endHour,   offset);

  const result: Record<string, Signal> = {};

  await Promise.all(
    rooms.map(async (roomId) => {
      const resourceId = ROOM_RESOURCE_IDS[roomId];
      if (!resourceId) { result[roomId] = "available"; return; }

      try {
        const bookingsData = (await pcoGet(
          `/resources/${resourceId}/resource_bookings`,
          {
            "where[starts_at][lte]": slotEndUtc,
            "where[ends_at][gte]": slotStartUtc,
            include: "event_resource_request",
            per_page: "100",
          }
        )) as PcoBookingsData;

        const bookings = bookingsData.data ?? [];
        if (bookings.length === 0) { result[roomId] = "available"; return; }

        const requestStatus = new Map<string, string>();
        for (const inc of bookingsData.included ?? []) {
          if (inc.type === "EventResourceRequest") {
            const status = inc.attributes?.approval_status;
            if (status) requestStatus.set(inc.id, status);
          }
        }

        let hasApproved = false;
        let allRejected = bookings.length > 0;

        for (const booking of bookings) {
          const reqId = booking.relationships?.event_resource_request?.data?.id;
          if (!reqId) { allRejected = false; continue; }
          const status = requestStatus.get(reqId) ?? "pending";
          const signal = STATUS_SIGNAL[status] ?? "ask";
          if (signal === "unavailable") { hasApproved = true; break; }
          if (signal !== "available") allRejected = false;
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
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
