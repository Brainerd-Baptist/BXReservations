import { NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";
import { createClient } from "@/lib/supabase/server";
import { FUNNEL_EVENTS, type FunnelEvent } from "@/lib/funnel";
import { rateLimit, clientIp, HOUR } from "@/lib/rate-limit";

// POST /api/funnel — one booking-funnel event from the Reserve page. Anonymous
// is fine (most visitors aren't signed in yet); input is strictly validated.
export async function POST(req: Request) {
  let b: { session_id?: unknown; event?: unknown; step?: unknown; detail?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad body" }, { status: 400 }); }
  const sid = typeof b.session_id === "string" ? b.session_id : "";
  const event = typeof b.event === "string" ? b.event : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(sid) || !FUNNEL_EVENTS.includes(event as FunnelEvent)) {
    return NextResponse.json({ error: "Bad event" }, { status: 400 });
  }
  const limited = await rateLimit("funnel", [{ key: clientIp(req), max: 300, windowSec: HOUR }]);
  if (limited) return new NextResponse(null, { status: 204 });
  const step = typeof b.step === "number" && Number.isInteger(b.step) && b.step >= 0 && b.step <= 10 ? b.step : null;
  const detail = typeof b.detail === "string" ? b.detail.replace(/[^\w .:/()-]/g, "").slice(0, 120) || null : null;

  let signedIn = false;
  try { signedIn = !!(await (await createClient()).auth.getUser()).data.user; } catch { /* anonymous */ }

  const { error } = await adminClient().from("bx_funnel_events").insert({ session_id: sid, event, step, detail, signed_in: signedIn });
  if (error) console.error("[funnel] insert failed:", error.message);
  return new NextResponse(null, { status: 204 });
}
