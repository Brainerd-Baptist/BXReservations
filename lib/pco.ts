/**
 * lib/pco.ts — Planning Center Calendar write integration
 *
 * Uses Basic-auth (PCO_APP_ID:PCO_SECRET) to create and tag events.
 * All public functions are fire-and-forget safe: they log errors but
 * never throw, so PCO failures never block reservation submission/approval.
 *
 * PCO Tag IDs (live):
 *   BX venue tag     : 70490
 *   BX Events view   : 248327
 *   Pending | Hold   : 430562
 *   Confirmed        : 430561
 *   Canceled         : 430563
 */

const PCO_BASE = "https://api.planningcenteronline.com/calendar/v2";

const TAG_BX_VENUE   = "70490";
const TAG_BX_EVENTS  = "248327";
const TAG_PENDING    = "430562";
const TAG_CONFIRMED  = "430561";
const TAG_CANCELED   = "430563";

function authHeader(): string {
  const id     = process.env.PCO_APP_ID  ?? "";
  const secret = process.env.PCO_SECRET  ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function pcoFetch(
  path: string,
  method: "POST" | "PATCH" | "DELETE" | "GET",
  body?: unknown
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (!process.env.PCO_APP_ID || !process.env.PCO_SECRET) {
    return { error: "PCO credentials not configured" };
  }
  const res = await fetch(`${PCO_BASE}${path}`, {
    method,
    headers: {
      Authorization:  authHeader(),
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[pco] ${method} ${path} → ${res.status}:`, text.slice(0, 500));
    return { error: `PCO ${res.status}: ${text.slice(0, 200)}` };
  }

  try {
    const json = JSON.parse(text) as { data?: Record<string, unknown> };
    return { data: json.data as Record<string, unknown> | undefined };
  } catch {
    return { data: undefined };
  }
}

// ─── Parse HH:MM time string into an ISO datetime on a given date ─────────────
function buildISO(dateStr: string, timeStr: string): string {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(`${dateStr}T12:00:00`); // noon to avoid DST issues
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d.toISOString();
}

interface DayConfig {
  date: string;
  included: boolean;
  customStart: string;
  customEnd: string;
  timeSlot: string;
  headcount: number;
}

// Derive start/end for a day based on timeBlock
function dayTimes(day: DayConfig): { starts_at: string; ends_at: string } {
  const blockMap: Record<string, [string, string]> = {
    morning:   ["08:00", "12:00"],
    afternoon: ["12:00", "17:00"],
    evening:   ["17:00", "22:00"],
    any:       ["08:00", "22:00"],
    full:      ["08:00", "22:00"],
    allday:    ["08:00", "22:00"],
  };
  const [defStart, defEnd] = blockMap[day.timeSlot] ?? ["08:00", "22:00"];
  return {
    starts_at: buildISO(day.date, day.customStart || defStart),
    ends_at:   buildISO(day.date, day.customEnd   || defEnd),
  };
}

// ─── Create PCO Calendar event and return its PCO event ID ───────────────────
export async function pcoCreateEvent(opts: {
  eventName:    string;
  orgName?:     string;
  notes?:       string;
  days:         DayConfig[];
  bookingNumber: string;
}): Promise<string | null> {
  const { eventName, orgName, notes, days, bookingNumber } = opts;
  const includedDays = days.filter(d => d.included);

  // Build a description from the available info
  const descParts: string[] = [];
  if (orgName)        descParts.push(`Organization: ${orgName}`);
  if (bookingNumber)  descParts.push(`Booking: ${bookingNumber}`);
  if (notes)          descParts.push(`Notes: ${notes}`);
  const description = descParts.join("\n");

  // 1️⃣  Create the event
  const eventRes = await pcoFetch("/events", "POST", {
    data: {
      type: "Event",
      attributes: {
        name: eventName,
      },
    },
  });

  if (eventRes.error || !eventRes.data?.id) {
    console.error("[pco] createEvent failed:", eventRes.error);
    return null;
  }

  const pcoEventId = eventRes.data.id as string;
  console.log(`[pco] created event ${pcoEventId} for ${bookingNumber}`);

  // 2️⃣  Tag the event: Pending|Hold + BX venue + BX Events view
  await pcoFetch(`/events/${pcoEventId}/relationships/tags`, "POST", {
    data: [
      { type: "Tag", id: TAG_PENDING   },
      { type: "Tag", id: TAG_BX_VENUE  },
      { type: "Tag", id: TAG_BX_EVENTS },
    ],
  });

  // 3️⃣  Create EventInstances for each included day
  const instancePromises = includedDays.map(day => {
    const { starts_at, ends_at } = dayTimes(day);
    return pcoFetch("/event_instances", "POST", {
      data: {
        type: "EventInstance",
        attributes: { starts_at, ends_at },
        relationships: {
          event: { data: { type: "Event", id: pcoEventId } },
        },
      },
    });
  });
  await Promise.allSettled(instancePromises);

  console.log(`[pco] created ${includedDays.length} instance(s) for event ${pcoEventId}`);
  return pcoEventId;
}

// ─── Update tag group: swap the status tag out ────────────────────────────────
// PATCH on relationships/tags replaces the full tag set.
// We keep BX venue + BX Events and swap the status tag.
async function pcoSetStatusTag(pcoEventId: string, statusTagId: string): Promise<void> {
  await pcoFetch(`/events/${pcoEventId}/relationships/tags`, "PATCH", {
    data: [
      { type: "Tag", id: statusTagId   },
      { type: "Tag", id: TAG_BX_VENUE  },
      { type: "Tag", id: TAG_BX_EVENTS },
    ],
  });
  console.log(`[pco] updated event ${pcoEventId} → tag ${statusTagId}`);
}

export async function pcoConfirmEvent(pcoEventId: string): Promise<void> {
  await pcoSetStatusTag(pcoEventId, TAG_CONFIRMED);
}

export async function pcoCancelEvent(pcoEventId: string): Promise<void> {
  await pcoSetStatusTag(pcoEventId, TAG_CANCELED);
}
