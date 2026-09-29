import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/event-map";
import { sendEmail, brandedEmailHtml } from "@/lib/email";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Params = { params: Promise<{ id: string }> };

// POST /api/reservations/[id]/agreement/sign
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const typedName: string = (body.typed_name ?? "").trim();
  const token:    string = (body.token ?? "").trim();

  if (!typedName || typedName.length < 2) {
    return NextResponse.json({ error: "Typed name is required." }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  // Load reservation
  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, contact_org, user_id")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Load agreement by token
  const { data: agreement } = await adminClient()
    .from("reservation_agreements")
    .select("id, token, agreement_text, customer_signed_at")
    .eq("reservation_id", res.id)
    .eq("token", token)
    .maybeSingle();

  if (!agreement) return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  if (agreement.customer_signed_at) {
    return NextResponse.json({ error: "This agreement has already been signed." }, { status: 409 });
  }

  // Capture signing metadata
  const ip        = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const signedAt  = new Date().toISOString();

  // Generate PDF
  let pdfUrl: string | null = null;
  try {
    const pdfDoc  = await PDFDocument.create();
    const font    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontB   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const text    = agreement.agreement_text as string;
    const lines   = text.split("\n");

    const pageW = 612, pageH = 792, margin = 60, lineH = 14, fontSize = 9;
    let page = pdfDoc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const drawLine = (t: string, bold = false, size = fontSize) => {
      if (y < margin + lineH * 2) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(t.slice(0, 100), {
        x: margin, y,
        font: bold ? fontB : font,
        size,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineH;
    };

    // Title
    drawLine("FACILITY USE AGREEMENT", true, 12);
    drawLine("Brainerd Baptist Church", false, 10);
    y -= lineH;

    // Body
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { y -= lineH / 2; continue; }
      const isHeader = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /^[A-Z0-9. ]+$/.test(trimmed);
      drawLine(trimmed, isHeader);
    }

    // Signature block
    y -= lineH * 2;
    drawLine("─────────────────────────────────────────────────────", false);
    drawLine(`Signed by: ${typedName}`, true);
    drawLine(`Date/Time: ${new Date(signedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "long" })} (Eastern)`, false);
    drawLine(`IP Address: ${ip}`, false);
    drawLine("Reservation: " + (res.booking_number ?? res.id.slice(0, 8)), false);

    const pdfBytes = await pdfDoc.save();
    const fileName = `agreements/${res.id}/${Date.now()}_signed.pdf`;
    const { error: uploadErr } = await adminClient().storage
      .from("bx-documents")
      .upload(fileName, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });

    if (!uploadErr) {
      const { data: urlData } = adminClient().storage.from("bx-documents").getPublicUrl(fileName);
      pdfUrl = urlData?.publicUrl ?? null;
      // If bucket is private, get a signed URL valid for 10 years (we'll store the path instead)
      if (!pdfUrl?.includes("bx-documents")) pdfUrl = fileName; // fallback: store path
    }
  } catch (e) {
    console.error("[agreement sign] PDF generation failed:", e);
    // Continue — don't block signing if PDF fails
  }

  // Update agreement row
  await adminClient().from("reservation_agreements").update({
    customer_name:       typedName,
    customer_signed_at:  signedAt,
    customer_ip:         ip,
    customer_user_agent: userAgent,
    pdf_url:             pdfUrl,
  }).eq("id", agreement.id);

  // History row
  await adminClient().from("reservation_history").insert({
    reservation_id: res.id,
    actor_id:       res.user_id ?? null,
    actor_name:     typedName,
    actor_role:     "user",
    action:         "agreement_signed",
    note:           `Facility Use Agreement signed by ${typedName}.`,
    metadata:       { ip, signed_at: signedAt },
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
          subject: `Agreement signed — ${res.booking_number ?? res.id.slice(0, 8)} (${res.event_name})`,
          html: brandedEmailHtml({
            headline: "Facility Use Agreement Signed",
            body: `
              <p style="margin:0 0 12px 0;">
                <strong style="color:#00205b;">${typedName}</strong> signed the Facility Use Agreement for
                reservation <strong style="color:#00205b;">${res.booking_number ?? res.id.slice(0, 8)}</strong> — ${res.event_name}.
              </p>
              <p style="margin:0 0 20px 0; padding:12px 16px; background-color:#f3f4f6; border-radius:8px; color:#374151; font-size:13px;">
                Signed ${new Date(signedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "long" })} ET
              </p>
            `,
            ctaText: "View in Admin Dashboard",
            ctaUrl: "https://bx.brainerdhq.app/admin/bx-reservations",
            footnoteHtml: pdfUrl ? `
              <p style="margin:0; font-size:13px; color:#6b7280; text-align:center;">
                <a href="${pdfUrl}" style="color:#00abc9; text-decoration:underline;">Download signed PDF</a>
              </p>
            ` : null,
          }),
        });
      }
    }
  } catch (e) {
    console.error("[agreement sign] admin notify failed:", e);
  }

  return NextResponse.json({ ok: true, signed_at: signedAt });
}
