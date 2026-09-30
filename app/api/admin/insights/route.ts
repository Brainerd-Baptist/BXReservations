import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { adminClient } from "@/lib/event-map";

export interface InsightsData {
  days: number;
  since: string;
  firstEventAt: string | null;
  collectingDays: number;
  funnel: { visits: number; details: number; review: number; attempted: number; booked: number };
  failures: { total: number; sessions: number; recovered: number; reasons: { reason: string; count: number }[] };
  signedInShare: number | null;   // of visits
  savedInDb: number;              // reservations created in the window (cross-check)
}

// GET /api/admin/insights?days=30 — booking funnel and failures (Phase 6)
export async function GET(req: Request) {
  const denied = await requireStaff();
  if (denied) return denied;
  const n = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(n) ? n : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = adminClient();

  const [ev, first, saved] = await Promise.all([
    db.from("bx_funnel_events").select("session_id, event, step, detail, signed_in").gte("created_at", since).order("created_at").limit(50_000),
    db.from("bx_funnel_events").select("created_at").order("created_at").limit(1),
    db.from("reservations").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  if (ev.error) return NextResponse.json({ error: ev.error.message }, { status: 500 });

  const sets = { visits: new Set<string>(), details: new Set<string>(), review: new Set<string>(), attempted: new Set<string>(), booked: new Set<string>(), failed: new Set<string>() };
  const signedIn = new Set<string>();
  const reasons = new Map<string, number>();
  let failTotal = 0;
  for (const e of ev.data ?? []) {
    const s = e.session_id as string;
    if (e.signed_in) signedIn.add(s);
    switch (e.event) {
      case "reserve_view": sets.visits.add(s); break;
      case "step_reached":
        if ((e.step ?? 0) >= 1) sets.details.add(s);
        if ((e.step ?? 0) >= 2) sets.review.add(s);
        break;
      case "submit_attempt": sets.attempted.add(s); break;
      case "submit_ok": sets.booked.add(s); break;
      case "submit_fail": {
        failTotal++; sets.failed.add(s);
        const r = failReason(String(e.detail ?? ""));
        reasons.set(r, (reasons.get(r) ?? 0) + 1);
        break;
      }
    }
  }
  // Later steps imply earlier ones (e.g. a reload mid-form skips the view event)
  for (const s of sets.booked) sets.attempted.add(s);
  for (const s of sets.attempted) sets.review.add(s);
  for (const s of sets.review) sets.details.add(s);
  for (const s of sets.details) sets.visits.add(s);

  const data: InsightsData = {
    days, since,
    firstEventAt: first.data?.[0]?.created_at ?? null,
    collectingDays: first.data?.[0]?.created_at ? Math.max(0, Math.floor((Date.now() - Date.parse(first.data[0].created_at)) / 86_400_000)) : 0,
    funnel: { visits: sets.visits.size, details: sets.details.size, review: sets.review.size, attempted: sets.attempted.size, booked: sets.booked.size },
    failures: {
      total: failTotal,
      sessions: sets.failed.size,
      recovered: [...sets.failed].filter((s) => sets.booked.has(s)).length,
      reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    },
    signedInShare: sets.visits.size ? [...sets.visits].filter((s) => signedIn.has(s)).length / sets.visits.size : null,
    savedInDb: saved.count ?? 0,
  };
  return NextResponse.json(data);
}

/** Plain-English reason from the tracker's short code. */
function failReason(d: string): string {
  if (d === "network") return "Couldn't reach the server (connection)";
  if (d === "timeout") return "Timed out after 60 seconds";
  if (d.startsWith("server")) return "Server error";
  const m = d.match(/^rejected \d{3}: (.+)$/);
  if (m) return `Turned away: ${m[1]}`.slice(0, 90);
  return d || "Unknown";
}
