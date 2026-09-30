import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";

// Fixed-window limits for public endpoints (C1 security). Keys are hashed so no
// raw IPs or emails are stored. If the limiter itself fails, requests go through
// (never lock people out because of a database hiccup).

type Rule = { key: string; max: number; windowSec: number };

// Keyed with a server secret so a stored hash can't be matched back to an IP by guessing
const SALT = process.env.RATE_LIMIT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "bx";
const hash = (s: string) => createHash("sha256").update(`bx-rl:${SALT}:${s}`).digest("hex").slice(0, 32);

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/** Returns a 429 response if any rule is over its limit, otherwise null. */
export async function rateLimit(name: string, rules: Rule[]): Promise<NextResponse | null> {
  try {
    const db = adminClient();
    for (const r of rules) {
      if (!r.key) continue;
      const { data, error } = await db.rpc("bx_rate_hit", { p_key: `${name}:${hash(r.key.trim().toLowerCase())}`, p_window_seconds: r.windowSec, p_max: r.max });
      if (error) { console.error("[rate-limit]", name, error.message); return null; }
      if (data === false) {
        const mins = Math.max(1, Math.round(r.windowSec / 60));
        return NextResponse.json(
          { error: `Too many attempts. Please wait ${mins >= 60 ? `${Math.round(mins / 60)} hour${mins >= 120 ? "s" : ""}` : `${mins} minutes`} and try again.` },
          { status: 429, headers: { "Retry-After": String(r.windowSec) } },
        );
      }
    }
  } catch (e) {
    console.error("[rate-limit]", name, (e as Error).message);
  }
  return null;
}

export const HOUR = 3600;
