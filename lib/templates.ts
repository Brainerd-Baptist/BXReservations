import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventMapContext } from "@/lib/event-map";
import { describePattern, patternFromPayload, sanitizePattern, type BookingPattern } from "@/lib/booking-pattern";

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  orgId: string | null;
  orgName: string | null;
  summary: string;
  pattern: BookingPattern;
}

type Row = { id: string; name: string; description: string | null; org_id: string | null; pattern: unknown; bx_organizations?: { name: string } | { name: string }[] | null };

function toSummary(r: Row): TemplateSummary | null {
  const pattern = sanitizePattern(r.pattern);
  if (!pattern) return null;
  const org = Array.isArray(r.bx_organizations) ? r.bx_organizations[0] : r.bx_organizations;
  return { id: r.id, name: r.name, description: r.description, orgId: r.org_id, orgName: org?.name ?? null, summary: describePattern(pattern), pattern };
}

/** Organizations a signed-in person is linked to. */
async function orgIdsFor(db: SupabaseClient, userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const { data } = await db.from("bx_org_users").select("org_id").eq("user_id", userId);
  return (data ?? []).map((r) => r.org_id as string);
}

/** Templates this person may start from: everyone's, plus their organizations'. */
export async function listTemplatesFor(db: SupabaseClient, userId: string | null): Promise<TemplateSummary[]> {
  const orgs = await orgIdsFor(db, userId);
  let q = db.from("bx_booking_templates").select("id, name, description, org_id, pattern, bx_organizations(name)").eq("active", true);
  q = orgs.length ? q.or(`org_id.is.null,org_id.in.(${orgs.join(",")})`) : q.is("org_id", null);
  const { data, error } = await q.order("sort_order").order("name").limit(50);
  if (error) { console.error("[templates] list failed:", error.message); return []; }
  // Their organization's templates first
  return ((data ?? []) as Row[]).map(toSummary).filter((t): t is TemplateSummary => !!t)
    .sort((a, b) => Number(!!b.orgId) - Number(!!a.orgId));
}

/** One template, only if this person may use it. */
export async function getTemplateFor(db: SupabaseClient, id: string, userId: string | null): Promise<TemplateSummary | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("bx_booking_templates").select("id, name, description, org_id, pattern, bx_organizations(name)").eq("id", id).eq("active", true).maybeSingle();
  if (!data) return null;
  if (data.org_id && !(await orgIdsFor(db, userId)).includes(data.org_id as string)) return null;
  return toSummary(data as Row);
}

/** The pattern of a booking this person can see, for "Book again". */
export async function patternForRebook(
  db: SupabaseClient,
  user: { id: string; email?: string | null },
  reservationId: string,
): Promise<{ pattern: BookingPattern; eventName: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return null;
  const ctx = await getEventMapContext(db, user, reservationId);
  if (!ctx) return null;
  const [{ data: res }, { data: charges }] = await Promise.all([
    db.from("reservations").select("payload, event_name").eq("id", reservationId).maybeSingle(),
    db.from("reservation_charges").select("addon_id, quantity").eq("reservation_id", reservationId).eq("kind", "addon"),
  ]);
  const addons: Record<string, number> = {};
  for (const c of charges ?? []) if (c.addon_id) addons[c.addon_id as string] = (addons[c.addon_id as string] ?? 0) + Number(c.quantity ?? 1);
  const pattern = patternFromPayload(res?.payload, addons);
  return pattern ? { pattern, eventName: (res?.event_name as string | null) ?? null } : null;
}
