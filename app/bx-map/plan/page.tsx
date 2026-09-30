// /bx-map/plan — pick which reservation to lay out on the map.
// Lists the reservations the signed-in person can edit or view; staff see
// every upcoming reservation.
import { loginHref } from "@/lib/return-path";
import { isUpcoming } from "@/lib/dates";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient, isStaffRole, reservationDates, reservedMapRoomIds, catalogueRoomName } from "@/lib/event-map";
import { RESERVATION_ROOM_TO_MAP } from "@/lib/event-map";
import { likeLiteral } from "@/lib/reservation-id";

export const metadata = { title: "Plan an event · BX Building Map" };

interface Row {
  id: string;
  booking_number: string | null;
  event_name: string;
  status: string;
  payload: unknown;
  user_id: string | null;
  contact_email: string;
}

function fmtDates(dates: string[]): string {
  if (!dates.length) return "Dates to be confirmed";
  const f = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return dates.length === 1 ? f(dates[0]) : `${f(dates[0])} – ${f(dates[dates.length - 1])}`;
}

function roomsSummary(payload: unknown): string {
  const ids = reservedMapRoomIds(payload);
  // catalogue rooms whose map rooms are in the reservation
  const names = Object.entries(RESERVATION_ROOM_TO_MAP)
    .filter(([, mapIds]) => mapIds.some((m) => ids.includes(m)))
    .map(([catId]) => catalogueRoomName(catId));
  return names.length ? names.join(" · ") : "No rooms selected yet";
}

export default async function PlanPage() {
  const { user } = await getUserAndRole();
  if (!user) redirect(loginHref("/bx-map/plan"));

  const db = adminClient();
  const { data: roleRow } = await db.from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const staff = isStaffRole(roleRow?.role as string | undefined);

  const select = "id, booking_number, event_name, status, payload, user_id, contact_email";
  // A failed query must not look like "no reservations"; a full page says so.
  const LIMIT = 200;
  let rows: Row[] = [];
  let loadFailed = false;
  let truncated = false;
  if (staff) {
    const { data, error } = await db
      .from("reservations")
      .select(select)
      .not("status", "in", "(cancelled,rejected,cancelled_by_user,cancelled_by_admin,auto_cancelled)")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    loadFailed = !!error;
    rows = (data ?? []) as Row[];
    truncated = rows.length === LIMIT;
  } else {
    // Yours by account, or by the booking's email matched exactly (any case).
    // Two plain queries: no user text inside a filter string (C1).
    const [{ data: ownById, error: ownErr }, { data: ownByEmail, error: emailErr }, { data: shared, error: sharedErr }] = await Promise.all([
      db
        .from("reservations")
        .select(select)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      user.email
        ? db.from("reservations").select(select).ilike("contact_email", likeLiteral(user.email)).order("created_at", { ascending: false }).limit(LIMIT)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      db
        .from("reservation_collaborators")
        .select(`reservations(${select})`)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .limit(LIMIT),
    ]);
    loadFailed = !!(ownErr || emailErr || sharedErr);
    const own = [...((ownById ?? []) as Row[]), ...((ownByEmail ?? []) as Row[])];
    truncated = (ownById?.length ?? 0) === LIMIT || (ownByEmail?.length ?? 0) === LIMIT;
    const seen = new Set<string>();
    for (const r of own) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
    for (const c of (shared ?? []) as unknown as { reservations: Row | Row[] | null }[]) {
      const r = Array.isArray(c.reservations) ? c.reservations[0] : c.reservations;
      if (r && !seen.has(r.id)) { seen.add(r.id); rows.push(r); }
    }
  }

  const withDates = rows.map((r) => ({ r, dates: reservationDates(r.payload) }));
  // Same rules as My Reservations: venue "today", every closed status (audit F09)
  const upcoming = withDates.filter(({ r }) => isUpcoming(r.status, r.payload));
  const past = withDates.filter((x) => !upcoming.includes(x));

  const card = ({ r, dates }: { r: Row; dates: string[] }) => (
    <Link
      key={r.id}
      href={`/reservations/${r.id}/event-map`}
      style={{
        display: "block",
        border: "1px solid color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        background: "var(--bx-surface)", backdropFilter: "blur(var(--bx-blur)) saturate(150%)", WebkitBackdropFilter: "blur(var(--bx-blur)) saturate(150%)", boxShadow: "inset 0 1px 0 var(--bx-highlight), var(--shadow-2)",
        textDecoration: "none",
        color: "var(--bx-parchment)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, fontSize: "1rem" }}>{r.event_name}</div>
        {r.booking_number && <div style={{ fontSize: "0.75rem", color: "var(--bx-slate)" }}>{r.booking_number}</div>}
      </div>
      <div style={{ fontSize: "0.875rem", color: "var(--bx-slate)", marginTop: "0.25rem" }}>{fmtDates(dates)}</div>
      <div style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>{roomsSummary(r.payload)}</div>
      <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--bx-accent-text)" }}>Open event map →</div>
    </Link>
  );

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>
      <Link href="/bx-map" style={{ fontSize: "0.875rem", color: "var(--bx-slate)", textDecoration: "none" }}>
        ← Building map
      </Link>
      <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "1.375rem", fontWeight: 700, color: "var(--bx-parchment)" }}>
        Plan an event on the map
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--bx-slate)", fontSize: "0.9375rem", lineHeight: 1.5 }}>
        Pick a reservation. You&apos;ll name each room for your event, tell us how to set it up, and it all saves to the
        reservation as you go.
      </p>

      {loadFailed && (
        <div role="alert" className="bx-tone-red" style={{ border: "1px solid", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1rem", fontSize: "0.9375rem" }}>
          We couldn&apos;t load your reservations just now. Reload the page to try again.
        </div>
      )}
      {truncated && (
        <p style={{ margin: "0 0 1rem", color: "var(--bx-slate)", fontSize: "0.8125rem" }}>
          Showing the {LIMIT} most recent reservations.
        </p>
      )}
      {!loadFailed && upcoming.length === 0 && (
        <div
          style={{
            border: "1px dashed color-mix(in srgb, var(--bx-parchment) 20%, transparent)",
            borderRadius: "12px",
            padding: "1.25rem",
            color: "var(--bx-slate)",
            fontSize: "0.9375rem",
          }}
        >
          No upcoming reservations yet.{" "}
          <Link href="/reserve" style={{ color: "var(--bx-accent-text)", fontWeight: 600 }}>
            Start a reservation
          </Link>{" "}
          and come back to lay it out.
        </div>
      )}
      <div style={{ display: "grid", gap: "0.75rem" }}>{upcoming.map(card)}</div>

      {past.length > 0 && (
        <>
          <h2 style={{ margin: "2rem 0 0.75rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bx-slate)" }}>
            Past events
          </h2>
          <div style={{ display: "grid", gap: "0.75rem", opacity: 0.8 }}>{past.slice(0, 10).map(card)}</div>
        </>
      )}
    </div>
  );
}
