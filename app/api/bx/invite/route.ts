import { NextRequest, NextResponse } from "next/server";
import { authEmailLink } from "@/lib/auth-links";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { type BxRole, can, ROLE_RANK } from "@/lib/roles";
import { brandedEmailHtml, sendEmail, escHtml } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

const ASSIGNABLE_ROLES: BxRole[] = ["booking_admin", "ministry_coordinator", "brainerd_staff", "member"];

const ROLE_LABELS: Record<BxRole, string> = {
  owner:                "Owner",
  system_admin:         "System Admin",
  booking_admin:        "Booking Admin",
  ministry_coordinator: "Ministry Coordinator",
  brainerd_staff:       "Brainerd Staff",
  member:               "Member",
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: callerRoleRow } = await svc
    .from("bx_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const callerRole = (callerRoleRow?.role ?? null) as BxRole | null;
  if (!can.manageUsers(callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; role?: string; name?: string; organization?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, role, name, organization } = body;
  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }
  if (!ASSIGNABLE_ROLES.includes(role as BxRole)) {
    return NextResponse.json({ error: `Invalid role for invite. Valid: ${ASSIGNABLE_ROLES.join(", ")}` }, { status: 400 });
  }

  // Caller can't assign a role higher than they can assign
  if (callerRole !== "owner" && ROLE_RANK[role as BxRole] >= ROLE_RANK[callerRole!]) {
    return NextResponse.json({ error: "Cannot assign a role equal to or above your own" }, { status: 403 });
  }

  const appUrl = SITE_URL;

  // Generate an invite link via Supabase Admin — this creates the user and returns
  // an action link WITHOUT sending Supabase's generic "You've been invited" email,
  // so we can send our own fully branded invitation email via Resend.
  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${appUrl}/reservations`,
      data: { bx_role: role },
    },
  });

  if (linkErr) {
    console.error("[bx/invite] generateLink error:", linkErr);
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  const inviteUrl = authEmailLink(linkData?.properties, "/reservations", "invite");
  if (!inviteUrl) {
    console.error("[bx/invite] No action_link returned from generateLink");
    return NextResponse.json({ error: "Failed to generate invite link" }, { status: 500 });
  }

  // Pre-assign the role and profile so everything is ready when they confirm
  const invitedUserId = linkData?.user?.id;
  if (invitedUserId) {
    await svc.from("bx_user_roles").upsert(
      { user_id: invitedUserId, email, role, assigned_by: user.id, assigned_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (name || organization) {
      await svc.from("bx_user_profiles").upsert(
        {
          user_id: invitedUserId,
          ...(name ? { display_name: name } : {}),
          ...(organization ? { organization } : {}),
        },
        { onConflict: "user_id" }
      );
    }
  }

  // Send branded invitation email via Resend
  const firstName = name ? name.split(" ")[0] : null;
  const roleLabel = ROLE_LABELS[role as BxRole] ?? role;
  const NAVY = "#00205b";
  const TEAL = "#00abc9";

  const html = brandedEmailHtml({
    preheader: `You've been invited to BX Reservations at Brainerd Baptist Church.`,
    headline:  "You're invited to BX Reservations.",
    body: `
      <p style="margin:0 0 16px 0;">Hi${firstName ? ` <strong style="color:${NAVY};">${escHtml(firstName)}</strong>` : ""},</p>
      <p style="margin:0 0 16px 0;">
        You've been invited to <strong>BX Reservations</strong> — the facility booking system
        for Brainerd Baptist Church. Your account has been set up with the role of
        <strong style="color:${NAVY};">${roleLabel}</strong>.
      </p>
      <p style="margin:0 0 16px 0;">
        BX is the community center at Brainerd Baptist — available for meetings, events,
        and private gatherings. Once you accept this invitation, you can log in and get started.
      </p>
      <p style="margin:0; color:#6b7280; font-size:13px;">
        This invitation link expires in 24 hours. If you didn't expect this email, you can safely ignore it.
      </p>`,
    ctaText:     "Accept Invitation",
    ctaUrl:      inviteUrl,
    footnoteHtml: `
      <p style="margin:0 0 10px 0;">
        Questions? Email
        <a href="mailto:BXreservations@brainerdbaptist.org" style="color:${TEAL}; text-decoration:underline;">BXreservations@brainerdbaptist.org</a>
        or call <a href="tel:4236434978" style="color:${TEAL}; text-decoration:underline;">(423) 643-4978</a>.
      </p>`,
  });

  try {
    await sendEmail({
      to:      email,
      subject: "You've been invited to BX Reservations",
      html,
    });
  } catch (emailErr) {
    // Don't fail the whole invite if email sending fails — the link was generated.
    console.error("[bx/invite] Resend error:", emailErr);
  }

  return NextResponse.json({ ok: true, email });
}
