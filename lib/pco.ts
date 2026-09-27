/**
 * lib/pco.ts — Planning Center Calendar write integration
 *
 * Auth: OAuth2 (preferred) or PAT Basic-auth fallback.
 *
 * OAUTH SETUP (one-time):
 *   1. Visit /api/pco-auth/start (as Josiah) to authorize the app.
 *   2. Copy the refresh token from the callback page.
 *   3. Save it as PCO_REFRESH_TOKEN in Vercel env vars + redeploy.
 *   4. Delete app/api/pco-auth/ from the repo.
 *
 * With PCO_REFRESH_TOKEN set, the app uses OAuth Bearer tokens.
 * PCO auto-assigns the owner from the OAuth user's Calendar Person record.
 * Josiah must be in PCO Calendar > Settings > People as an Event Administrator
 * for auto-assignment to succeed. Do NOT send owner explicitly — PCO rejects it
 * as "Forbidden Attribute" in both attribute and relationship forms.
 *
 * PCO Tag IDs (live):
 *   BX venue tag     : 70490
 *   BX Events view   : 248327
 *   BX Ministry type : 241212  (required tag group)
 *   Pending | Hold   : 430562
 *   Confirmed        : 430561
 *   Canceled         : 430563
 */

const PCO_BASE = "https://api.planningcenteronline.com/calendar/v2";
const TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";

const TAG_BX_VENUE    = "70490";
const TAG_BX_EVENTS   = "248327";
const TAG_BX_MINISTRY = "241212";
const TAG_PENDING     = "430562";
const TAG_CONFIRMED   = "430561";
const TAG_CANCELED    = "430563";

// ─── Token cache (in-process, resets on cold start) ─────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  const refreshToken = process.env.PCO_REFRESH_TOKEN;

  // If no refresh token, fall back to PAT Basic auth (won't work for event
  // creation but keeps read operations and status-tag PATCHes functional).
  if (!refreshToken) return null;

  // Return cached token if still valid (with 60s buffer).
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     process.env.PCO_APP_ID,
        client_secret: process.env.PCO_PAT ?? process.env.PCO_SECRET,
      }),
    });
    if (!res.ok) {
      console.error("[pco] token refresh failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json() as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedToken;
  } catch (err) {
    console.error("[pco] token refresh error:", err);
    return null;
  }
}

async function authHeader(): Promise<string> {
  const accessToken = await getAccessToken();
  if (accessToken) return `Bearer ${accessToken}`;

  // PAT Basic auth fallback (event creation will fail with owner_id error).
  const id     = process.env.PCO_APP_ID ?? "";
  const secret = process.env.PCO_PAT ?? process.env.PCO_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function pcoFetch(
  path: string,
  method: "POST" | "PATCH" | "DELETE" | "GET",
  body?: unknown
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (!process.env.PCO_APP_ID || !(process.env.PCO_PAT || process.env.PCO_SECRET || process.env.PCO_REFRESH_TOKEN)) {
    return { error: "PCO credentials not configured" };
  }
  const auth = await authHeader();
  const res = await fetch(`${PCO_BASE}${path}`, {
    method,
    headers: {
      Authorization:  auth,
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
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(`${dateStr}T12:00:00`);
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
  const { eventName, days, bookingNumber } = opts;
  const includedDays = days.filter(d => d.included);

  // 1️⃣  Create the event.
  //     PCO auto-assigns owner from the OAuth user's Calendar person record.
  //     Do NOT send owner explicitly — PCO rejects it ("Forbidden Attribute")
  //     in both attribute and relationship forms.
  //     Prerequisite: Josiah must be in PCO Calendar > Settings > People
  //     as an Event Administrator for auto-assignment to succeed.
  const eventRes = await pcoFetch("/events", "POST", {
    data: {
      type: "Event",
      attributes: {
        name: eventName,
      },
      relationships: {
        tags: {
          data: [
            { type: "Tag", id: TAG_PENDING     },
            { type: "Tag", id: TAG_BX_VENUE    },
            { type: "Tag", id: TAG_BX_EVENTS   },
            { type: "Tag", id: TAG_BX_MINISTRY },
          ],
        },
      },
    },
  });

  if (eventRes.error || !eventRes.data?.id) {
    console.error("[pco] createEvent failed:", eventRes.error);
    return null;
  }

  const pcoEventId = eventRes.data.id as string;
  console.log(`[pco] created event ${pcoEventId} for ${bookingNumber}`);

  // 2️⃣  Create EventInstances for each included day
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
async function pcoSetStatusTag(pcoEventId: string, statusTagId: string): Promise<void> {
  await pcoFetch(`/events/${pcoEventId}/relationships/tags`, "PATCH", {
    data: [
      { type: "Tag", id: statusTagId     },
      { type: "Tag", id: TAG_BX_VENUE    },
      { type: "Tag", id: TAG_BX_EVENTS   },
      { type: "Tag", id: TAG_BX_MINISTRY },
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
