import { NextResponse } from "next/server";

/**
 * GET /api/debug/pco-write-test
 * Tests PCO Calendar write: creates a test event, tags it, creates an instance,
 * then deletes it. Returns full PCO response bodies so we can see exactly what's failing.
 * REMOVE AFTER DEBUGGING.
 */
export async function GET() {
  const appId  = process.env.PCO_APP_ID  ?? "";
  const secret = process.env.PCO_SECRET  ?? "";

  if (!appId || !secret) {
    return NextResponse.json({ ok: false, stage: "env", error: "Credentials missing" });
  }

  const auth = "Basic " + Buffer.from(`${appId}:${secret}`).toString("base64");

  async function pcoCall(path: string, method: string, body?: unknown) {
    const res = await fetch(`https://api.planningcenteronline.com/calendar/v2${path}`, {
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      } as Record<string, string>,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* raw text */ }
    return { ok: res.ok, status: res.status, body: json ?? text };
  }

  // Step 1: Create event
  const createRes = await pcoCall("/events", "POST", {
    data: {
      type: "Event",
      attributes: {
        name: "BX Debug Test (auto-delete)",
        featured: false,
      },
    },
  });

  if (!createRes.ok) {
    return NextResponse.json({ ok: false, stage: "create_event", status: createRes.status, body: createRes.body });
  }

  const pcoEventId = ((createRes.body as { data?: { id?: string } })?.data?.id) ?? null;
  if (!pcoEventId) {
    return NextResponse.json({ ok: false, stage: "parse_id", raw: createRes.body });
  }

  // Step 2: Tag the event
  const tagRes = await pcoCall(`/events/${pcoEventId}/relationships/tags`, "POST", {
    data: [
      { type: "Tag", id: "430562" },
      { type: "Tag", id: "70490"  },
      { type: "Tag", id: "248327" },
    ],
  });

  // Step 3: Create an event instance (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ds = tomorrow.toISOString().slice(0, 10);
  const instanceRes = await pcoCall("/event_instances", "POST", {
    data: {
      type: "EventInstance",
      attributes: {
        starts_at: `${ds}T09:00:00Z`,
        ends_at:   `${ds}T12:00:00Z`,
      },
      relationships: {
        event: { data: { type: "Event", id: pcoEventId } },
      },
    },
  });

  // Step 4: Delete the test event (cleanup)
  const deleteRes = await pcoCall(`/events/${pcoEventId}`, "DELETE");

  return NextResponse.json({
    ok: true,
    pcoEventId,
    steps: {
      create_event:    { ok: createRes.ok,   status: createRes.status },
      tag_event:       { ok: tagRes.ok,      status: tagRes.status,      body: tagRes.body      },
      create_instance: { ok: instanceRes.ok, status: instanceRes.status, body: instanceRes.body },
      delete_event:    { ok: deleteRes.ok,   status: deleteRes.status },
    },
  });
}
