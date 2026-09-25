import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  sendReservationConfirmation,
  sendAdminNewReservationAlert,
} from "@/lib/email";
import { ROOMS } from "@/lib/rooms";

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
  timeBlock: string;
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
}

// ─── Booking number generator ─────────────────────────────────────────────────
function generateFallbackBookingNumber(): string {
  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-4);
  return `BX-${year}-${suffix}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractDates(days: DayConfig[]): string[] {
  return days
    .filter(d => d.included)
    .map(d => {
      const dt = new Date(d.date + "T12:00:00");
      return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
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

      const { data: numData, error: numErr } = await supabase.rpc("next_booking_number");
      if (numErr || !numData) {
        console.error("booking_number rpc error:", numErr);
        return NextResponse.json({ error: "Failed to generate booking number" }, { status: 500 });
      }

      const bookingNumber: string = numData as string;

      const { data: insertData, error: insertErr } = await supabase.from("reservations").insert({
        booking_number:  bookingNumber,
        status:          "pending_insurance",
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

      // ── Send emails (non-blocking — don't fail the request if email fails) ──
      const dates = extractDates(days);
      const rooms = extractRooms(days);

      Promise.allSettled([
        sendReservationConfirmation({
          to:            contact.email,
          name:          contact.name,
          bookingNumber,
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
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(`[email] send #${i} failed:`, r.reason);
          }
        });
      });

      return NextResponse.json({ bookingNumber, reservationId }, { status: 201 });
    } catch (err) {
      console.error("Supabase submit error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── Path B: Supabase not yet configured ───────────────────────────────────
  console.log("📋 BX RESERVATION SUBMISSION (no DB):", JSON.stringify({
    contact,
    spaceMode,
    notes,
    days: days.filter(d => d.included).map(d => ({
      date:      d.date,
      headcount: d.headcount,
      timeBlock: d.timeBlock,
      rooms:     d.rooms.filter(r => r.requested).map(r => r.roomId),
    })),
  }, null, 2));

  const bookingNumber = generateFallbackBookingNumber();

  // Still attempt emails in dev/fallback mode
  const dates = extractDates(days);
  const rooms = extractRooms(days);
  Promise.allSettled([
    sendReservationConfirmation({ to: contact.email, name: contact.name, bookingNumber, eventName: contact.eventName, dates, rooms }),
    sendAdminNewReservationAlert({ bookingNumber, submitterName: contact.name, submitterEmail: contact.email, eventName: contact.eventName, dates, rooms, notes: notes || undefined }),
  ]).catch(() => {});

  return NextResponse.json({ bookingNumber }, { status: 201 });
}
