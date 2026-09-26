import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient } from "@/lib/event-map";
import { sendEmail } from "@/lib/email";

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

  // Verify ownership
  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, user_id, status")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: collab } = await adminClient()
    .from("reservation_collaborators")
    .select("id")
    .eq("reservation_id", res.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (res.user_id !== user.id && !collab) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const { data: adminRoles } = await adminClient().from("bx_user_roles").select("user_id").in("role", ["admin", "staff"]);
    if (adminRoles?.length) {
      const adminIds = adminRoles.map((a: { user_id: string }) => a.user_id);
      const { data: authUsers } = await adminClient().auth.admin.listUsers();
      const adminEmails = authUsers?.users?.filter(u => adminIds.includes(u.id)).map(u => u.email).filter(Boolean) ?? [];
      for (const email of adminEmails.slice(0, 5)) {
        await sendEmail({
          to: email as string,
          subject: `COI uploaded — ${res.booking_number ?? res.id.slice(0, 8)} (${res.event_name})`,
          html: `
            <p><strong>${res.contact_name}</strong> uploaded a Certificate of Insurance for reservation <strong>${res.booking_number ?? res.id.slice(0, 8)}</strong> — ${res.event_name}.</p>
            <p><a href="${fileUrl}">View COI</a></p>
            <p><a href="https://bx.brainerdhq.app/admin/bx-reservations">Review in admin dashboard</a></p>
          `,
        });
      }
    }
  } catch (e) {
    console.error("[coi upload] admin notify failed:", e);
  }

  return NextResponse.json({ ok: true, file_url: fileUrl }, { status: 201 });
}
