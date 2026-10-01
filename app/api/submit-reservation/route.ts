import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  sendReservationConfirmation,
  sendAdminNewReservationAlert,
} from "@/lib/email";
import { ROOMS } from "@/lib/rooms";
import { pcoCreateEvent } from "@/lib/pco";
import { rateLimit, clientIp, HOUR } from "@/lib/rate-limit";
import { type BlackoutRule } from "@/lib/blackouts";
import { checkDays } from "@/lib/booking-checks";
import { can, reservationFlagsForRole, type BxRole } from "@/lib/roles";
import { attachRewardAtSubmit } from "@/lib/survey";
import { addAddons, syncRoomCharges } from "@/lib/room-prices";

// ─── Types mirrored from reserve/page.tsx ─────────────────────────────────────
interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  org: string;
  eventName: string;
  isNonProfit: boolean;
}

interface DayConfig {
  date: string;
  included: boolean;
  headcount: number;
  timeSlot: string;
  customStart: string;
  customEnd: string;
  rooms: {
    roomId: string;
    setup: string;
    customSetup: string;
    requested: boolean;
    role: "main" | "extra";
  }[];
}

interface SubmitBody {
  contact: ContactInfo;
  days: DayConfig[];
  spaceMode: "single" | "main-plus" | "multiple";
  notes: string;
  addons?: { addon_id: string; quantity: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeSlotLabel: Record<string, string> = {
  morning:   "Morning (8am–12pm)",
  afternoon: "Afternoon (12pm–5pm)",
  evening:   "Evening (5pm–10pm)",
  any:       "All Day (8am–10pm)",
  full:      "All Day (8am–10pm)",
  allday:    "All Day (8am–10pm)",
};

function extractDates(days: DayConfig[]): string[] {
  return days
    .filter(d => d.included)
    .map(d => {
      const dt = new Date(d.date + "T12:00:00");
      const dateStr = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      const label = d.customStart
        ? `Custom (${d.customStart}–${d.customEnd || "end"})`
        : (timeSlotLabel[d.timeSlot] ?? "All Day");
      return `${dateStr} — ${label}`;
    });
}

function extractRooms(days: DayConfig[]): string[] {
  const seen = new Set<string>();
  for (const day of days) {
    if (!day.included) continue;
    for (const r of day.rooms) {
      seen.add(r.roomId);  // include all selected rooms regardless of availability conflict flag
    }
  }
  return [...seen].map(id => ROOMS.find(r => r.id === id)?.name ?? id);
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { contact, days, spaceMode, notes } = body;

  if (!contact?.name || !contact?.email || !contact?.eventName) {
    return NextResponse.json({ error: "Missing required contact fields" }, { status: 400 });
  }

  // Bot trap: a hidden field people never see or fill in.
  const trap = (body as unknown as { website?: unknown }).website;
  if (typeof trap === "string" && trap.trim()) {
    return NextResponse.json({ error: "Your request couldn't be sent." }, { status: 400 });
  }
  const limited = await rateLimit("submit", [
    { key: clientIp(req), max: 12, windowSec: HOUR },
    { key: contact.email, max: 6, windowSec: HOUR },
  ]);
  if (limited) return limited;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── Path A: Supabase configured ───────────────────────────────────────────
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Resolve the authenticated user so we can attach user_id to the reservation
      const cookieStore = await cookies();
      const ssrClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
      );
      const { data: { user: authUser } } = await ssrClient.auth.getUser();

      // ── Re-check the dates on the server (C2) — the browser checks too, but a
      // request can skip it. Church staff and ministry coordinators may book any day.
      const { data: roleRow } = authUser
        ? await supabase.from("bx_user_roles").select("role").eq("user_id", authUser.id).maybeSingle()
        : { data: null };
      const role = (roleRow?.role as BxRole | undefined) ?? null;
      const flags = reservationFlagsForRole(role);
      if (!can.bookOutsideWindow(role)) {
        const { data: rules } = await supabase.from("blackout_rules").select("id, rule_type, data, label, active").eq("active", true);
        const problem = checkDays(days, (rules ?? []) as BlackoutRule[]);
        if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      }

      const { data: numData, error: numErr } = await supabase.rpc("next_booking_number");
      if (numErr || !numData) {
        console.error("booking_number rpc error:", numErr);
        return NextResponse.json({ error: "Failed to generate booking number" }, { status: 500 });
      }

      const bookingNumber: string = numData as string;

      const { data: insertData, error: insertErr } = await supabase.from("reservations").insert({
        booking_number:  bookingNumber,
        church_use:      flags.church_use,
        waived:          flags.waived,
        status:          "pending",
        contact_name:    contact.name,
        contact_email:   contact.email,
        contact_phone:   contact.phone ?? null,
        contact_org:     contact.org ?? null,
        event_name:      contact.eventName,
        is_non_profit:   contact.isNonProfit ?? false,
        space_mode:      spaceMode,
        notes:           notes ?? null,
        payload:         { contact, days, spaceMode, notes },
        user_id:         authUser?.id ?? null,
      }).select("id").single();

      if (insertErr || !insertData) {
        console.error("insert error:", insertErr);
        return NextResponse.json({ error: "Failed to save reservation" }, { status: 500 });
      }
      const reservationId = insertData.id as string;

      // ── Add-ons chosen on the form → charge lines at catalog price, following
      // each add-on's room and hour rules (lib/addon-pricing)
      const picked = (Array.isArray(body.addons) ? body.addons : [])
        .map((a) => ({ id: String(a?.addon_id ?? ""), qty: Math.min(500, Math.max(0, Math.floor(Number(a?.quantity) || 0))) }))
        .filter((a) => a.id && a.qty > 0)
        .slice(0, 30);
      await addAddons(supabase, reservationId, picked, { actorId: authUser?.id ?? null, staff: false })
        .catch((e) => console.error("[submit] add-ons insert failed:", (e as Error).message));

      // ── Room rental lines from the schedule and the price list — the same
      // numbers the booking page showed (skipped when payment isn't needed)
      await syncRoomCharges(supabase, reservationId, { actorId: authUser?.id ?? null })
        .catch((e) => console.error("[submit] room charges failed:", (e as Error).message));

      // ── Survey thank-you: an earned discount comes off this booking automatically
      if (!flags.waived.payment) {
        await attachRewardAtSubmit(supabase, reservationId, authUser ? { id: authUser.id, email: authUser.email } : null)
          .catch((e) => console.error("[submit] reward attach failed:", (e as Error).message));
      }

      // ── PCO Calendar event creation (awaited — serverless functions terminate on response) ──
      const pcoEventId = await pcoCreateEvent({
        eventName:     contact.eventName,
        orgName:       contact.org ?? undefined,
        notes:         notes ?? undefined,
        days,
        bookingNumber,
      }).catch((err: unknown) => {
        console.error("[pco] createEvent threw:", err);
        return null;
      });

      if (pcoEventId) {
        const { error: pErr } = await supabase
          .from("reservations")
          .update({ pco_event_id: pcoEventId })
          .eq("id", reservationId);
        if (pErr) console.error("[pco] failed to store pco_event_id:", pErr);
        else console.log(`[pco] stored pco_event_id ${pcoEventId} on ${bookingNumber}`);
      } else {
        console.warn("[pco] createEvent returned null — check PCO credentials or API errors above");
      }

      // ── Send emails (non-blocking — don't fail the request if email fails) ──
      const dates = extractDates(days);
      const rooms = extractRooms(days);

      // after(): on Vercel, work left running after the response is sent can be
      // frozen mid-way — that's how the confirmation email went missing.
      after(() => Promise.allSettled([
        sendReservationConfirmation({
          to:            contact.email,
          name:          contact.name,
          bookingNumber,
          reservationId,
          eventName:     contact.eventName,
          dates,
          rooms,
        }),
        sendAdminNewReservationAlert({
          bookingNumber,
          submitterName:  contact.name,
          submitterEmail: contact.email,
          eventName:      contact.eventName,
          dates,
          rooms,
          notes:          notes || undefined,
        }),
      ]).then(results => {
        const labels = ["customer-confirm", "admin-alert"];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            console.log(`[email] ${labels[i]} sent OK for ${bookingNumber}`);
          } else {
            console.error(`[email] ${labels[i]} FAILED for ${bookingNumber}:`, r.reason);
          }
        });
      }));

      // ── In-app bell notification: alert all admins about new reservation ──
      after(async () => {
        try {
          const { createClient: createServiceClient } = await import("@supabase/supabase-js");
          const adminSupa = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
          );
          const { data: adminRoles } = await adminSupa
            .from("bx_user_roles")
            .select("user_id")
            .in("role", ["owner", "system_admin", "booking_admin"]);

          if (adminRoles && adminRoles.length > 0) {
            const notifRows = adminRoles.map((r: { user_id: string }) => ({
              user_id:        r.user_id,
              reservation_id: reservationId,
              type:           "new_reservation",
              title:          `New reservation request`,
              body:           `${contact.name} submitted a request for "${contact.eventName}" (${bookingNumber}).`,
            }));
            const { error: nErr } = await adminSupa.from("bx_notifications").insert(notifRows);
            if (nErr) console.error("[notif] admin insert error:", nErr);
            else console.log(`[notif] new_reservation inserted for ${adminRoles.length} admin(s) — ${bookingNumber}`);
          }
        } catch (err) {
          console.error("[notif] admin notification error:", err);
        }
      });

      return NextResponse.json({ bookingNumber, reservationId }, { status: 201 });
    } catch (err) {
      console.error("Supabase submit error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── No database configured: say so instead of pretending it worked (C2).
  console.error("[submit-reservation] Supabase is not configured");
  return NextResponse.json({ error: "Reservations are temporarily unavailable. Please call the BX office." }, { status: 503 });
}
