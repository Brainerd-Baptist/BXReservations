import { NextRequest, NextResponse } from "next/server";

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
// Stateless fallback: timestamp-based sequence suffix.
// Replaced by DB function once Supabase is configured.
function generateFallbackBookingNumber(): string {
  const year = new Date().getFullYear();
  // Use last 4 digits of ms timestamp as unique-enough suffix for dev/testing
  const suffix = String(Date.now()).slice(-4);
  return `BX-${year}-${suffix}`;
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

  // Validate required fields
  if (!contact?.name || !contact?.email || !contact?.eventName) {
    return NextResponse.json({ error: "Missing required contact fields" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  // ── Path A: Supabase configured ───────────────────────────────────────────
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Generate booking number via DB function
      const { data: numData, error: numErr } = await supabase
        .rpc("next_booking_number");

      if (numErr || !numData) {
        console.error("booking_number rpc error:", numErr);
        return NextResponse.json({ error: "Failed to generate booking number" }, { status: 500 });
      }

      const bookingNumber: string = numData as string;

      // Insert reservation row
      const { error: insertErr } = await supabase.from("reservations").insert({
        booking_number: bookingNumber,
        status: "pending_insurance",
        contact_name: contact.name,
        contact_email: contact.email,
        contact_phone: contact.phone ?? null,
        contact_org: contact.org ?? null,
        event_name: contact.eventName,
        is_non_profit: contact.isNonProfit ?? false,
        space_mode: spaceMode,
        notes: notes ?? null,
        payload: { contact, days, spaceMode, notes },
      });

      if (insertErr) {
        console.error("insert error:", insertErr);
        return NextResponse.json({ error: "Failed to save reservation" }, { status: 500 });
      }

      return NextResponse.json({ bookingNumber }, { status: 201 });
    } catch (err) {
      console.error("Supabase submit error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── Path B: Supabase not yet configured (dev / pre-launch) ────────────────
  // Log the full payload to Vercel function logs so staff can review submissions
  // even before the database is wired.
  console.log("📋 BX RESERVATION SUBMISSION (no DB):", JSON.stringify({
    contact,
    spaceMode,
    notes,
    days: days.filter(d => d.included).map(d => ({
      date: d.date,
      headcount: d.headcount,
      timeBlock: d.timeBlock,
      rooms: d.rooms.filter(r => r.requested).map(r => r.roomId),
    })),
  }, null, 2));

  const bookingNumber = generateFallbackBookingNumber();
  return NextResponse.json({ bookingNumber }, { status: 201 });
}
