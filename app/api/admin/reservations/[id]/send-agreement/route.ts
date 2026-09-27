import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient, isStaffRole } from "@/lib/event-map";
import { sendEmail, brandedEmailHtml } from "@/lib/email";
import crypto from "crypto";

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

async function requireAdmin(sb: Awaited<ReturnType<typeof sbServer>>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: role } = await adminClient()
    .from("bx_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !isStaffRole(role.role)) return null;
  return { user, role: role.role as string };
}

async function getAgreementTemplate(r: {
  contact_name: string; contact_org: string | null;
  event_name: string; payload: Record<string, unknown>;
}): Promise<string> {
  // Try to load from bx_settings first
  const { data: setting } = await adminClient()
    .from("bx_settings")
    .select("value")
    .eq("key", "agreement_template")
    .maybeSingle();

  let template = (setting?.value as string | null) ?? null;

  if (!template) {
    // Fallback: build a minimal inline template
    const dates = (r.payload?.dates as string[])?.join(", ") ?? "dates to be confirmed";
    const spaces = (r.payload?.spaces as string[])?.join(", ") ?? "spaces to be confirmed";
    const org = r.contact_org ?? r.contact_name;
    template = `FACILITY USE AGREEMENT\nBrainerd Baptist Church — BX Event Spaces\n\nThis Facility Use Agreement is entered into between Brainerd Baptist Church ("Church") and ${org} ("Renter"), represented by ${r.contact_name}.\n\nEVENT DETAILS\nEvent Name: ${r.event_name}\nReserved Spaces: ${spaces}\nEvent Date(s): ${dates}\n\nBy typing your full legal name below, you acknowledge that you have read and agree to all terms communicated by BX staff.`;
  }

  // Interpolate context variables into template
  const org = r.contact_org ?? r.contact_name;
  const dates = (r.payload?.dates as string[])?.join(", ") ?? "dates to be confirmed";
  const spaces = (r.payload?.spaces as string[])?.join(", ") ?? "spaces to be confirmed";
  const headcount = String((r.payload?.headcount as number) ?? "TBD");

  return template
    .replace(/\{\{renter_name\}\}/g, r.contact_name)
    .replace(/\{\{renter_org\}\}/g, org)
    .replace(/\{\{event_name\}\}/g, r.event_name)
    .replace(/\{\{event_dates\}\}/g, dates)
    .replace(/\{\{event_spaces\}\}/g, spaces)
    .replace(/\{\{headcount\}\}/g, headcount);
}

// POST /api/admin/reservations/[id]/send-agreement
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = await sbServer();
  const actor = await requireAdmin(sb);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: res } = await adminClient()
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, contact_org, status, payload")
    .or(`id.eq.${id},booking_number.eq.${id}`)
    .single();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check for an existing unsent/unsigned agreement
  const { data: existing } = await adminClient()
    .from("reservation_agreements")
    .select("id, customer_signed_at")
    .eq("reservation_id", res.id)
    .maybeSingle();

  if (existing?.customer_signed_at) {
    return NextResponse.json({ error: "Agreement already signed." }, { status: 409 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const agreementText = await getAgreementTemplate({
    contact_name: res.contact_name as string,
    contact_org:  res.contact_org as string | null,
    event_name:   res.event_name as string,
    payload:      (res.payload ?? {}) as Record<string, unknown>,
  });

  // Upsert agreement row
  if (existing) {
    await adminClient().from("reservation_agreements").update({
      token, agreement_text: agreementText, sent_by: actor.user.id, sent_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await adminClient().from("reservation_agreements").insert({
      reservation_id: res.id,
      token,
      agreement_text: agreementText,
      sent_by: actor.user.id,
      sent_at: new Date().toISOString(),
    });
  }

  // Set status to pending_documents if not already there
  if (!["pending_documents", "pending_payment", "approved", "confirmed", "completed"].includes(res.status as string)) {
    await adminClient().from("reservations").update({ status: "pending_documents" }).eq("id", res.id);
  }

  // History row
  await adminClient().from("reservation_history").insert({
    reservation_id: res.id,
    actor_id:       actor.user.id,
    actor_name:     actor.user.email ?? "Admin",
    actor_role:     "admin",
    action:         "agreement_sent",
    note:           "Facility Use Agreement sent for signature.",
  });

  // Email to user
  const signingUrl = `https://bx.brainerdhq.app/reservations/${res.id}/agreement?token=${token}`;
  if (res.contact_email) {
    try {
      await sendEmail({
        to: res.contact_email as string,
        subject: `Action required: Please sign your Facility Use Agreement (${res.booking_number ?? res.id.slice(0, 8)})`,
        html: brandedEmailHtml({
          headline: "Facility Use Agreement",
          body: `
            <p style="margin:0 0 20px 0;">
              Hi <strong style="color:#00205b;">${res.contact_name ?? "there"}</strong> —
              your reservation for <strong style="color:#00205b;">${res.event_name}</strong> is moving forward.
              Please review and sign the Facility Use Agreement to continue.
            </p>
          `,
          ctaText: "Sign Agreement",
          ctaUrl: signingUrl,
          footnoteHtml: `
            <p style="margin:0 0 12px 0; font-size:13px; color:#6b7280; text-align:center;">
              This link is specific to your reservation (${res.booking_number ?? (res.id as string).slice(0, 8)}).
              If you have questions, reply to this email or message us through the portal.
            </p>
          `,
        }),
      });
    } catch (e) {
      console.error("[send-agreement] email failed:", e);
    }
  }

  return NextResponse.json({ ok: true, token });
}
