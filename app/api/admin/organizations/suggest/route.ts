import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Very lightweight fuzzy match: token overlap score
function similarityScore(a: string, b: string): number {
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

// GET ?contact_org=First+Presbyterian
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contactOrg = searchParams.get("contact_org") ?? "";
  if (!contactOrg.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  const sb = adminSb();
  const { data: orgs } = await sb
    .from("bx_organizations")
    .select("id, name, canonical_name, primary_contact_name, primary_contact_email");

  const scored = (orgs ?? [])
    .map((o) => ({
      ...o,
      score: Math.max(
        similarityScore(contactOrg, o.name),
        similarityScore(contactOrg, o.canonical_name ?? ""),
      ),
    }))
    .filter((o) => o.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return NextResponse.json({ suggestions: scored });
}
