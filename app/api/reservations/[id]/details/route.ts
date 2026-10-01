import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { isClosedStatus } from "@/lib/dates";
import { ROOMS } from "@/lib/rooms";
import { sendEmail, brandedEmailHtml } from "@/lib/email";
import { findConflicts, type Conflict } from "@/lib/conflicts";
import { syncRoomCharges } from "@/lib/room-prices";

type Params = { params: Promise<{ id: string }> };

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOTS = ["any", "morning", "afternoon", "evening"];
const ROOM_IDS = new Set(ROOMS.map((r) => r.id));

type Day = {
  date: string; included: boolean; headcount: number; customStart: string; customEnd: string;
  timeSlot: string; rooms: { roomId: string; setup: string; customSetup: string; requested: boolean; role: string }[];
  [k: string]: unknown;
};

/** GET — current editable details + what this person may change */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const db = adminClient();
  const ctx = await getEventMapContext(db, user, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: r } = await db.from("reservations")
    .select("id, status, event_name, contact_name, contact_email, contact_phone, contact_org, notes, is_non_profit, payload")
    .eq("id", ctx.reservation.id).single();
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const open = !(isClosedStatus(r.status) || ["declined", "expired"].includes(r.status ?? ""));
  return NextResponse.json({
    reservation: { ...r, days: (r.payload as { days?: unknown[] } | null)?.days ?? [] },
    review: ctx.staff ? ((r.payload as { schedule_review?: unknown } | null)?.schedule_review ?? null) : null,
    staff: ctx.staff,
    canEdit: ctx.staff || (ctx.access === "edit" && open),
    canRequestChange: !ctx.staff && ctx.access === "edit" && open,
  });
}

/**
 * PATCH /api/reservations/[id]/details — edit a booking.
 * Organizer / co-organizer (while open): event name, contact name, phone,
 *   organization, notes, and each day's headcount.
 * Staff: all of that plus contact email, non-profit flag and the schedule
 *   (days, times, rooms). Requesters ask for schedule changes instead
 *   (POST …/change-request).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const db = adminClient();
  const ctx = await getEventMapContext(db, user, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const staff = ctx.staff;
  if (!staff && ctx.access !== "edit") return NextResponse.json({ error: "Only the organizer or a co-organizer can edit this booking." }, { status: 403 });

  const { data: r } = await db.from("reservations")
    .select("id, status, booking_number, event_name, contact_name, contact_email, contact_phone, contact_org, notes, is_non_profit, payload, user_id")
    .eq("id", ctx.reservation.id).single();
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!staff && (isClosedStatus(r.status) || ["declined", "expired"].includes(r.status ?? ""))) {
    return NextResponse.json({ error: "This booking is closed — message the BX team for changes." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const payload = { ...(r.payload ?? {}) } as { contact?: Record<string, unknown>; days?: Day[]; notes?: string; [k: string]: unknown };
  const contact = { ...(payload.contact ?? {}) } as Record<string, unknown>;
  const cols: Record<string, unknown> = {};
  const changes: string[] = [];
  const set = (col: string, contactKey: string | null, value: unknown, label: string) => {
    if (value === undefined) return;
    if ((r as Record<string, unknown>)[col] === value) return;
    cols[col] = value;
    if (contactKey) contact[contactKey] = value;
    changes.push(label);
  };

  const eventName = str(body.event_name, 120);
  if (eventName !== undefined && eventName.length < 2) return NextResponse.json({ error: "Give the event a name." }, { status: 400 });
  const contactName = str(body.contact_name, 120);
  if (contactName !== undefined && contactName.length < 2) return NextResponse.json({ error: "Enter the contact's full name." }, { status: 400 });
  const phone = str(body.contact_phone, 40);
  if (phone && phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a phone number with area code." }, { status: 400 });

  set("event_name", "eventName", eventName, "event name");
  set("contact_name", "name", contactName, "contact name");
  set("contact_phone", "phone", phone === undefined ? undefined : phone || null, "phone");
  set("contact_org", "org", str(body.contact_org, 120) === undefined ? undefined : str(body.contact_org, 120) || null, "organization");
  const notes = str(body.notes, 4000);
  if (notes !== undefined && notes !== (r.notes ?? "")) { cols.notes = notes || null; payload.notes = notes; changes.push("notes"); }

  if (staff) {
    const email = str(body.contact_email, 200)?.toLowerCase();
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    set("contact_email", "email", email, "contact email");
    if (typeof body.is_non_profit === "boolean") set("is_non_profit", "isNonProfit", body.is_non_profit, "non-profit status");
  }

  // ── Days ──
  const oldDays = Array.isArray(payload.days) ? (payload.days as Day[]) : [];
  let acknowledged: Conflict[] = [];
  let conflictNote = "";
  if (Array.isArray(body.days)) {
    const incoming = body.days as Partial<Day>[];
    if (!staff) {
      // Requesters: headcount only, matched by date
      let changed = false;
      const next = oldDays.map((d) => {
        const m = incoming.find((x) => x?.date === d.date);
        const hc = m ? Math.max(1, Math.min(5000, Math.floor(Number(m.headcount) || 0))) : d.headcount;
        if (m && hc !== d.headcount) changed = true;
        return m ? { ...d, headcount: hc } : d;
      });
      if (changed) { payload.days = next; changes.push("headcount"); }
    } else {
      // Staff: full schedule
      const next: Day[] = [];
      for (const x of incoming) {
        if (!x || typeof x.date !== "string" || !YMD.test(x.date)) return NextResponse.json({ error: "Each day needs a valid date." }, { status: 400 });
        const start = String(x.customStart ?? ""), end = String(x.customEnd ?? "");
        if ((start && !HM.test(start)) || (end && !HM.test(end))) return NextResponse.json({ error: "Times must look like 09:00." }, { status: 400 });
        if (start && end && end <= start) return NextResponse.json({ error: `End time must be after start on ${x.date}.` }, { status: 400 });
        const prev = oldDays.find((d) => d.date === x.date) ?? {};
        const prevRooms = ((prev as Partial<Day>).rooms ?? []);
        const seenRooms = new Set<string>();
        const rooms = (Array.isArray(x.rooms) ? x.rooms : [])
          .filter((rm) => rm && ROOM_IDS.has(String(rm.roomId)) && !seenRooms.has(String(rm.roomId)) && !!seenRooms.add(String(rm.roomId)))
          .map((rm, i) => ({
            roomId: String(rm.roomId), setup: String(rm.setup ?? ""), customSetup: String(rm.customSetup ?? "").slice(0, 200),
            // Every listed room is booked; keep the "had a conflict" mark from the original request
            requested: prevRooms.some((p) => p.roomId === String(rm.roomId) && p.requested === true),
            role: i === 0 ? "main" : (rm.role === "main" ? "main" : "extra"),
          }));
        next.push({
          ...prev, date: x.date, included: x.included !== false,
          headcount: Math.max(1, Math.min(5000, Math.floor(Number(x.headcount) || 1))),
          customStart: start, customEnd: end,
          timeSlot: SLOTS.includes(String(x.timeSlot)) ? String(x.timeSlot) : "any",
          rooms,
        } as Day);
      }
      if (!next.length) return NextResponse.json({ error: "A booking needs at least one day." }, { status: 400 });
      next.sort((a, b) => a.date.localeCompare(b.date));
      const sig = (ds: Day[]) => JSON.stringify(ds.map((d) => [d.date, d.included !== false, d.headcount, d.customStart, d.customEnd, d.timeSlot, (d.rooms ?? []).map((rm) => [rm.roomId, rm.setup])]));
      if (sig(next) !== sig(oldDays)) {
        // Calendar check on what changed. Staff see the clashes and either
        // go back or confirm the overlap is OK ("acknowledge_conflicts").
        const conflicts = await findConflicts(db, r.id, oldDays, next);
        if (conflicts.length && body.acknowledge_conflicts !== true) {
          return NextResponse.json({ error: "Possible conflicts", conflicts }, { status: 409 });
        }
        if (conflicts.length) {
          conflictNote = String(body.conflict_note ?? "").trim().slice(0, 500);
          acknowledged = conflicts;
          payload.schedule_review = {
            conflicts, note: conflictNote || null, approved_by: user.id, approved_at: new Date().toISOString(),
          };
        } else if (payload.schedule_review) {
          delete payload.schedule_review;   // nothing clashes any more
        }
        payload.days = next;
        if (JSON.stringify(next.map((d) => d.headcount)) !== JSON.stringify(oldDays.map((d) => d.headcount))) changes.push("headcount");
        changes.push("schedule");
      }
    }
  }

  if (!changes.length) return NextResponse.json({ ok: true, changed: [] });
  payload.contact = contact;
  const { error } = await db.from("reservations").update({ ...cols, payload, updated_at: new Date().toISOString() }).eq("id", r.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // New schedule or rate type → room charges follow (unless staff set them by hand)
  if (changes.includes("schedule") || changes.includes("non-profit status")) {
    await syncRoomCharges(db, r.id, { actorId: user.id }).catch((e) => console.error("[details] room charges failed:", (e as Error).message));
  }

  const { data: prof } = await db.from("bx_user_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  const who = (prof?.display_name as string | undefined) ?? user.email ?? "Someone";
  const list = [...new Set(changes)].join(", ");
  await db.from("reservation_history").insert({
    reservation_id: r.id, actor_id: user.id, actor_name: who, actor_role: staff ? "admin" : "user",
    action: "details_edited", note: `Updated ${list}.`,
  });
  if (acknowledged.length) {
    await db.from("reservation_history").insert({
      reservation_id: r.id, actor_id: user.id, actor_name: who, actor_role: "admin",
      action: "conflict_approved",
      note: `Approved overlap: ${acknowledged.map((c) => c.message).join(" ")}${conflictNote ? ` — ${conflictNote}` : ""}`.slice(0, 1000),
    });
  }

  // Let the other side know
  const ref = r.booking_number ?? r.id.slice(0, 8);
  const title = (eventName ?? r.event_name) || "your event";
  after(async () => {
    try {
      if (staff && r.user_id && r.user_id !== user.id) {
        await db.from("bx_notifications").insert({ user_id: r.user_id, reservation_id: r.id, type: "details_edited", title: "Your booking was updated", body: `The BX team updated ${list} on ${title} (${ref}).` });
      } else if (!staff) {
        const { data: admins } = await db.from("bx_user_roles").select("user_id").in("role", ["owner", "system_admin", "booking_admin"]);
        if (admins?.length) {
          await db.from("bx_notifications").insert(admins.map((a: { user_id: string }) => ({
            user_id: a.user_id, reservation_id: r.id, type: "details_edited", title: "Booking details changed", body: `${who} updated ${list} on ${title} (${ref}).`,
          })));
        }
      }
      if (staff && r.contact_email && changes.includes("schedule")) {
        await sendEmail({
          to: (cols.contact_email as string) ?? r.contact_email,
          subject: `Your booking ${ref} was updated`,
          html: brandedEmailHtml({
            headline: "Your booking was updated",
            body: `<p style="margin:0 0 16px 0;">The BX team updated the <strong>${esc(list)}</strong> for <strong>${esc(title)}</strong> (${esc(ref)}). Please look it over.</p>`,
            ctaText: "Review your booking",
            ctaUrl: `https://bx.brainerdhq.app/reservations/${r.id}`,
            footnoteHtml: null,
          }),
        });
      }
    } catch (e) { console.error("[details] notify failed:", e); }
  });

  return NextResponse.json({ ok: true, changed: [...new Set(changes)] });
}
