import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient, getEventMapContext } from "@/lib/event-map";
import { resolveReservationId } from "@/lib/reservation-id";
import { sendEmail, brandedEmailHtml, escHtml } from "@/lib/email";

/** Magic-byte check for the three accepted formats. */
function looksLike(b: Buffer, type: string): boolean {
  if (type === "application/pdf") return b.subarray(0, 5).toString("latin1") === "%PDF-";
  if (type === "image/png") return b.length > 8 && b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG";
  if (type === "image/jpeg") return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return false;
}

type Params = { params: Promise<{ id: string }> };

async function sbServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
}

// POST /api/reservations/[id]/coi — user uploads COI
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Organizer (by account or contact email), accepted co-organizer, or staff —
  // the same rule as the rest of the booking (C1). Viewers can't upload.
  const db = adminClient();
  const ctx = await getEventMapContext(db, user, await resolveReservationId(db, id));
  if (!ctx || ctx.access !== "edit") {
    return NextResponse.json({ error: ctx ? "Only the organizer or a co-organizer can upload insurance." : "Not found" }, { status: ctx ? 403 : 404 });
  }
  const { data: res } = await db
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, user_id, status")
    .eq("id", ctx.reservation.id)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Parse multipart form — file field named "file"
  let fileBytes: Buffer;
  let fileName:  string;
  let mimeType:  string;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF, JPG, and PNG files are accepted." }, { status: 415 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 20 MB." }, { status: 413 });
    }

    const arrayBuf = await file.arrayBuffer();
    fileBytes = Buffer.from(arrayBuf);
    // Check the file itself, not just the type the browser claims (C1).
    if (!looksLike(fileBytes, file.type)) {
      return NextResponse.json({ error: "That file doesn't look like a real PDF, JPG or PNG." }, { status: 415 });
    }
    fileName  = file.name;
    mimeType  = file.type;
  } catch {
    return NextResponse.json({ error: "Failed to parse upload." }, { status: 400 });
  }

  const storagePath = `coi/${res.id}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadErr } = await adminClient().storage
    .from("bx-documents")
    .upload(storagePath, fileBytes, { contentType: mimeType, upsert: true });

  if (uploadErr) {
    console.error("[coi upload] storage error:", uploadErr);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data: urlData } = adminClient().storage.from("bx-documents").getPublicUrl(storagePath);
  const fileUrl = urlData?.publicUrl ?? storagePath;

  // Update reservation COI fields
  await adminClient().from("reservations").update({
    coi_uploaded_at: new Date().toISOString(),
    coi_file_url:    fileUrl,
    // Clear previous acceptance if re-uploading
    coi_accepted_at:   null,
    coi_accepted_by:   null,
    coi_expiry_date:   null,
  }).eq("id", res.id);

  // History row
  await adminClient().from("reservation_history").insert({
    reservation_id: res.id,
    actor_id:       user.id,
    actor_name:     res.contact_name ?? user.email ?? "Guest",
    actor_role:     "user",
    action:         "document_uploaded",
    note:           `Certificate of Insurance uploaded: ${fileName}`,
    metadata:       { file_url: fileUrl, file_name: fileName },
  });

  // Notify admins
  try {
    const { data: adminRoles } = await adminClient().from("bx_user_roles").select("user_id").in("role", ["owner", "system_admin", "booking_admin"]);
    if (adminRoles?.length) {
      const adminIds = adminRoles.map((a: { user_id: string }) => a.user_id);
      const { data: authUsers } = await adminClient().auth.admin.listUsers();
      const adminEmails = authUsers?.users?.filter(u => adminIds.includes(u.id)).map(u => u.email).filter(Boolean) ?? [];
      for (const email of adminEmails.slice(0, 5)) {
        await sendEmail({
          to: email as string,
          subject: `COI uploaded — ${res.booking_number ?? res.id.slice(0, 8)} (${res.event_name})`,
          html: brandedEmailHtml({
            headline: "Certificate of Insurance Uploaded",
            body: `
              <p style="margin:0 0 16px 0;">
                <strong style="color:#00205b;">${escHtml(res.contact_name)}</strong> uploaded a Certificate of Insurance
                for reservation <strong style="color:#00205b;">${res.booking_number ?? res.id.slice(0, 8)}</strong> — ${escHtml(res.event_name)}.
              </p>
            `,
            ctaText: "Review in Admin Dashboard",
            ctaUrl: "https://bx.brainerdhq.app/admin/bx-reservations",
            footnoteHtml: `
              <p style="margin:0; font-size:13px; color:#6b7280; text-align:center;">
                <a href="${fileUrl}" style="color:#00abc9; text-decoration:underline;">Download COI directly</a>
              </p>
            `,
          }),
        });
      }
    }
  } catch (e) {
    console.error("[coi upload] admin notify failed:", e);
  }

  return NextResponse.json({ ok: true, file_url: fileUrl }, { status: 201 });
}
