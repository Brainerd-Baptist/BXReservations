import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "text/plain",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Look up the reservation by token ──────────────────────────────────────
  const { data: res, error: fetchErr } = await supabase
    .from("reservations")
    .select("id, booking_number, contact_name, contact_email, event_name, schedule_uploaded_at")
    .eq("schedule_upload_token", token)
    .maybeSingle();

  if (fetchErr || !res) {
    return NextResponse.json({ error: "Upload link not found or expired" }, { status: 404 });
  }

  if (res.schedule_uploaded_at) {
    return NextResponse.json({ error: "Schedule already uploaded for this booking" }, { status: 409 });
  }

  // ── Parse multipart form ───────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Please upload a PDF, Word document, or image." }, { status: 415 });
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  // Path: event-schedules/{reservationId}/{timestamp}-{originalName}
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storagePath  = `${res.id}/${Date.now()}-${safeFilename}`;
  const arrayBuffer  = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("event-schedules")
    .upload(storagePath, arrayBuffer, {
      contentType:    file.type,
      upsert:         false,
    });

  if (uploadErr) {
    console.error("[schedule-upload] storage error:", uploadErr);
    return NextResponse.json({ error: "File upload failed. Please try again." }, { status: 500 });
  }

  // Generate a long-lived signed URL for admin preview (10 years)
  const { data: signedData, error: signErr } = await supabase.storage
    .from("event-schedules")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

  const scheduleUrl = signErr ? null : signedData?.signedUrl ?? null;

  // ── Update reservation record ──────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("reservations")
    .update({
      schedule_uploaded_at:  new Date().toISOString(),
      schedule_filename:     file.name,
      schedule_url:          scheduleUrl,
      // Null out the token so the link can no longer be reused
      schedule_upload_token: null,
    })
    .eq("id", res.id);

  if (updateErr) {
    console.error("[schedule-upload] update error:", updateErr);
    // File is in storage but DB didn't update — log for manual recovery
    return NextResponse.json({ error: "Upload saved but record update failed. Contact support." }, { status: 500 });
  }

  console.log(`[schedule-upload] ${res.booking_number} — uploaded by ${res.contact_email}: ${file.name}`);

  return NextResponse.json({
    success: true,
    filename: file.name,
    booking:  res.booking_number,
  });
}

/** GET: returns reservation info for the upload page (name, event, already uploaded?) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: res, error } = await supabase
    .from("reservations")
    .select("booking_number, contact_name, event_name, schedule_uploaded_at, schedule_filename")
    .eq("schedule_upload_token", token)
    .maybeSingle();

  if (error || !res) {
    return NextResponse.json({ error: "Upload link not found or expired" }, { status: 404 });
  }

  return NextResponse.json({
    bookingNumber:      res.booking_number,
    name:               res.contact_name,
    eventName:          res.event_name,
    alreadyUploaded:    !!res.schedule_uploaded_at,
    uploadedFilename:   res.schedule_filename ?? null,
  });
}
