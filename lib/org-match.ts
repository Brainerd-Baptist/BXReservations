// ─── Org fuzzy-match pipeline ─────────────────────────────────────────────────
// Used at reservation submission time to link contact_org text → organization_id.
// Uses Postgres pg_trgm similarity() for matching.
//
// Thresholds (confirmed by Josiah 2026-10-01):
//   >= 0.92  → auto-link silently (method: 'exact' if 1.0, 'fuzzy' if <1.0)
//   0.75–0.91 → flag for admin review, do NOT auto-link
//   < 0.75  → create new org (pending_review) + flag as new_org
//   Multiple in 0.75–0.92 band → flag as 'duplicate', pick none

import { createServerClient } from "@supabase/ssr";
import { normalizeOrgName, canonicalOrgName } from "@/lib/org-name";

type SupabaseClient = ReturnType<typeof createServerClient>;

export type OrgMatchMethod = "exact" | "fuzzy" | "manual" | "none";
export type FlagType = "new_org" | "fuzzy_match" | "duplicate" | "user_mismatch" | "name_typo";

export interface MatchCandidate {
  id: string;
  name: string;
  confidence: number;
}

export interface OrgMatchResult {
  organization_id: string | null;
  org_match_confidence: number | null;
  org_match_method: OrgMatchMethod;
  flag_type: FlagType | null;
  candidates: MatchCandidate[];
}

const THRESHOLD_AUTO = 0.92;
const THRESHOLD_FLAG = 0.75;

/**
 * Main entry point. Call at reservation submission time.
 * Returns what to write to the reservation row and what flag (if any) to create.
 */
export async function matchOrCreateOrg(
  db: SupabaseClient,
  rawOrgText: string
): Promise<OrgMatchResult> {
  const canonical = canonicalOrgName(rawOrgText);
  if (!canonical) {
    return { organization_id: null, org_match_confidence: null, org_match_method: "none", flag_type: null, candidates: [] };
  }

  // Query pg_trgm similarity against all non-merged orgs
  const { data, error } = await db.rpc("bx_org_similarity_search", {
    query_text: canonical,
    min_similarity: THRESHOLD_FLAG,
  });

  if (error) {
    console.error("[org-match] similarity search error:", error.message);
    return { organization_id: null, org_match_confidence: null, org_match_method: "none", flag_type: null, candidates: [] };
  }

  const candidates: MatchCandidate[] = (data ?? []).map((r: { id: string; name: string; sim: number }) => ({
    id: r.id,
    name: r.name,
    confidence: r.sim,
  }));

  // Exact match (similarity = 1.0 after canonical comparison)
  const exact = candidates.find((c) => c.confidence >= 0.9999);
  if (exact) {
    return {
      organization_id: exact.id,
      org_match_confidence: exact.confidence,
      org_match_method: "exact",
      flag_type: null,
      candidates: [],
    };
  }

  // Strong match — auto-link + flag for confirmation
  const strong = candidates.filter((c) => c.confidence >= THRESHOLD_AUTO);
  if (strong.length === 1) {
    return {
      organization_id: strong[0].id,
      org_match_confidence: strong[0].confidence,
      org_match_method: "fuzzy",
      flag_type: "fuzzy_match",
      candidates: strong,
    };
  }

  // Ambiguous — multiple strong matches
  if (strong.length > 1) {
    return {
      organization_id: null,
      org_match_confidence: strong[0].confidence,
      org_match_method: "none",
      flag_type: "duplicate",
      candidates: strong,
    };
  }

  // Weak matches — flag but don't link
  const weak = candidates.filter((c) => c.confidence >= THRESHOLD_FLAG && c.confidence < THRESHOLD_AUTO);
  if (weak.length > 0) {
    return {
      organization_id: null,
      org_match_confidence: weak[0].confidence,
      org_match_method: "none",
      flag_type: weak.length === 1 ? "fuzzy_match" : "duplicate",
      candidates: weak,
    };
  }

  // No match — create new org
  const normalizedName = normalizeOrgName(rawOrgText);
  const { data: newOrg, error: createError } = await db
    .from("bx_organizations")
    .insert({
      name: normalizedName,
      canonical_name: canonical,
      tier: "external",
      status: "pending_review",
    })
    .select("id")
    .single();

  if (createError || !newOrg) {
    console.error("[org-match] failed to create new org:", createError?.message);
    return { organization_id: null, org_match_confidence: null, org_match_method: "none", flag_type: null, candidates: [] };
  }

  return {
    organization_id: newOrg.id,
    org_match_confidence: null,
    org_match_method: "fuzzy",
    flag_type: "new_org",
    candidates: [],
  };
}

/**
 * Write a flag row to bx_org_flags.
 * Call after matchOrCreateOrg when flag_type is non-null.
 */
export async function createOrgFlag(
  db: SupabaseClient,
  {
    reservationId,
    rawText,
    flagType,
    suggestedOrgId,
    confidence,
    candidates,
  }: {
    reservationId: string;
    rawText: string;
    flagType: FlagType;
    suggestedOrgId: string | null;
    confidence: number | null;
    candidates: MatchCandidate[];
  }
) {
  await db.from("bx_org_flags").insert({
    reservation_id: reservationId,
    raw_text: rawText,
    flag_type: flagType,
    suggested_org_id: suggestedOrgId ?? (candidates[0]?.id ?? null),
    confidence,
    candidates: candidates.length > 0 ? candidates : null,
  });
}

/**
 * Run backfill: find all reservations with contact_org but no organization_id
 * and push them through the match pipeline, creating flags for admin review.
 * Safe to call multiple times (skips already-flagged reservations).
 */
export async function backfillUnlinkedReservations(db: SupabaseClient) {
  // Find already-flagged reservation IDs so we don't double-flag
  const { data: existingFlags } = await db
    .from("bx_org_flags")
    .select("reservation_id")
    .not("reservation_id", "is", null);
  const alreadyFlagged = new Set((existingFlags ?? []).map((f: { reservation_id: string }) => f.reservation_id));

  const { data: unlinked } = await db
    .from("reservations")
    .select("id, contact_org")
    .is("organization_id", null)
    .not("contact_org", "is", null)
    .neq("contact_org", "");

  if (!unlinked?.length) return { processed: 0 };

  let processed = 0;
  for (const res of unlinked) {
    if (alreadyFlagged.has(res.id)) continue;

    const result = await matchOrCreateOrg(db, res.contact_org);

    // Update the reservation row
    await db.from("reservations").update({
      organization_id: result.organization_id,
      org_match_confidence: result.org_match_confidence,
      org_match_method: result.org_match_method ?? "none",
    }).eq("id", res.id);

    // Create flag if needed
    if (result.flag_type) {
      await createOrgFlag(db, {
        reservationId: res.id,
        rawText: res.contact_org,
        flagType: result.flag_type,
        suggestedOrgId: result.organization_id,
        confidence: result.org_match_confidence,
        candidates: result.candidates,
      });
    }

    processed++;
  }

  return { processed };
}
