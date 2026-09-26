import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendStatusUpdateEmail } from "@/lib/email";

// ─── Room / setup labels ───────────────────────────────────────────────────────
const ROOM_LABELS: Record<string, string> = {
  crossing:        "The Crossing",
  crossview:       "CrossView",
  loft:            "The Loft",
  "crosspointe-a": "CrossPointe A",
  "crosspointe-b": "CrossPointe B",
  "crosspointe-c": "CrossPointe C",
  crosstiesA:      "CrossTies A",
  crosstiesB:      "CrossTies B",
  crosstiesC:      "CrossTies C",
  crosstiescafe:   "CrossTies Café",
};

const SETUP_LABELS: Record<string, string> = {
  theater:   "Theater",
  classroom: "Classroom",
  banquet:   "Banquet/Rounds",
  reception: "Reception",
  custom:    "Custom",
};

// ─── Status mapping ────────────────────────────────────────────────────────────
// DB (new)       → Admin label         → User label
// pending            Requested            Submitted — Awaiting Review
// under_review       Proposal Sent        Proposal Ready
// needs_info         Needs Info           More Information Requested
// pending_documents  Pending Documents    Documents Required
// pending_payment    Pending Payment      Payment Required
// approved           Deposit Received     Approved
// confirmed          Confirmed            Confirmed
// completed          Completed            Completed
// cancelled          Declined             Cancelled
// cancelled_by_admin Cancelled by BX      Cancelled by BX Team
// cancelled_by_user  Cancelled by User    You Cancelled This Request
// auto_cancelled     Expired              Request Expired

const DB_TO_ADMIN: Record<string, string> = {
  pending:            "Requested",
  under_review:       "Proposal Sent",
  needs_info:         "Needs Info",
  pending_documents:  "Pending Documents",
  pending_payment:    "Pending Payment",
  approved:           "Deposit Received",
  confirmed:          "Confirmed",
  completed:          "Completed",
  cancelled:          "Declined",
  cancelled_by_admin: "Cancelled by BX",
  cancelled_by_user:  "Cancelled by User",
  auto_cancelled:     "Expired",
};

const ADMIN_TO_DB: Record<string, string> = {
  "Requested":          "pending",
  "Proposal Sent":      "under_review",
  "Needs Info":         "needs_info",
  "Pending Documents":  "pending_documents",
  "Pending Payment":    "pending_payment",
  "Deposit Received":   "approved",
  "Confirmed":          "confirmed",
  "Completed":          "completed",
  "Declined":           "cancelled",
  "Cancelled by BX":    "cancelled_by_admin",
  "Cancelled by User":  "cancelled_by_user",
  "Expired":            "auto_cancelled",
};

// ─── GET — list all reservations ──────────────────────────────────────────────
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("reservations")
    .select("id, booking_number, status, event_name, contact_name, contact_email, contact_org, is_non_profit, created_at, payload, coi_accepted_at, coi_uploaded_at, payment_received_at, organization_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/reservations] fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch signed agreements to build a lookup map
  const { data: agmtData } = await supabase
    .from("reservation_agreements")
    .select("reservation_id, customer_signed_at")
    .not("customer_signed_at", "is", null);
  const signedReservations = new Set<string>(
    (agmtData ?? []).map((a: { reservation_id: string }) => a.reservation_id)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests = (data ?? []).map((row: any) => {
    const payload   = (row.payload ?? {}) as Record<string, unknown>;
    const days      = (payload.days as Record<string, unknown>[]) ?? [];
    const firstDay  = (days[0] ?? {}) as Record<string, unknown>;
    const rooms     = (firstDay.rooms as Record<string, unknown>[]) ?? [];
    const firstRoom = (rooms[0] ?? {}) as Record<string, unknown>;
    const roomId    = (firstRoom.roomId as string) ?? "";
    const setup     = (firstRoom.setup  as string) ?? "";

    return {
      id:         row.booking_number as string,
      dbId:       row.id as string,
      name:       (row.contact_name as string) || (row.contact_email as string),
      org:        (row.contact_org  as string) ?? "",
      email:      row.contact_email as string,
      room:       ROOM_LABELS[roomId] ?? roomId,
      date:       (firstDay.date as string) ?? "",
      event:      (row.event_name  as string) ?? "",
      guests:     (firstDay.headcount as number) ?? 0,
      setup:      SETUP_LABELS[setup] ?? setup,
      estimate:   (payload.estimate    as number)  ?? (firstDay.estimate    as number)  ?? 0,
      status:     DB_TO_ADMIN[row.status as string] ?? "Requested",
      submitted:  (row.created_at as string).split("T")[0],
      nonProfit:  (row.is_non_profit as boolean) ?? false,
      avNeeded:   (payload.avNeeded    as boolean) ?? (firstDay.avNeeded    as boolean) ?? false,
      tablecloths:(payload.tablecloths as number)  ?? (firstDay.tablecloths as number)  ?? 0,
      flexible:   (payload.flexible    as boolean) ?? (firstDay.flexible    as boolean) ?? false,
      // Document completion flags
      agreementSigned: signedReservations.has(row.id as string),
      coiAccepted:     !!(row.coi_accepted_at),
      hasPayment:      !!(row.payment_received_at),
      organizationId:  row.organization_id as string | undefined,
    };
  });

  return NextResponse.json(requests);
}

// ─── PATCH — update status + log history + send email ────────────────────────
export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    dbId:             string;
    status:           string;
    note?:            string;   // admin note attached to this status change
    cancelReason?:    string;   // for cancelled_by_admin
    actorId?:         string;   // admin's user_id (optional, from client)
    actorName?:       string;   // admin's display name
  };
  const { dbId, status, note, cancelReason, actorId, actorName } = body;

  if (!dbId || !status) {
    return NextResponse.json({ error: "Missing dbId or status" }, { status: 400 });
  }

  const dbStatus = ADMIN_TO_DB[status];
  if (!dbStatus) {
    return NextResponse.json({ error: `Unknown admin status: ${status}` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch the reservation so we can send a status email + write history
  const { data: row, error: fetchErr } = await supabase
    .from("reservations")
    .select("id, booking_number, event_name, contact_name, contact_email, status, payload, user_id")
    .eq("id", dbId)
    .single();

  if (fetchErr || !row) {
    console.error("[admin/reservations] fetch-before-update error:", fetchErr);
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const prevDbStatus = row.status as string;

  // Build update payload — include cancellation fields when relevant
  const updateFields: Record<string, unknown> = {
    status:     dbStatus,
    updated_at: new Date().toISOString(),
  };
  if (dbStatus === "cancelled_by_admin") {
    updateFields.cancelled_by      = actorName ?? "BX Team";
    updateFields.cancellation_reason = cancelReason ?? note ?? null;
    updateFields.cancelled_at      = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from("reservations")
    .update(updateFields)
    .eq("id", dbId);

  if (updateErr) {
    console.error("[admin/reservations] update error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // ── Write a richer history row (the trigger writes a minimal row; we upsert
  //    the actor info and note by finding the just-inserted row and updating it)
  // Actually, since the trigger fires synchronously, we can just insert an additional
  // history row with the human note and actor details if note/actor are provided.
  if (note || actorId || actorName) {
    const { error: histErr } = await supabase.from("reservation_history").insert({
      reservation_id: dbId,
      actor_id:       actorId  ?? null,
      actor_name:     actorName ?? "BX Admin",
      actor_role:     "admin",
      action:         "admin_note",
      from_status:    prevDbStatus,
      to_status:      dbStatus,
      note:           note ?? cancelReason ?? null,
    });
    if (histErr) {
      console.warn("[history] insert error (non-fatal):", histErr);
    }
  }

  // ── Status-change email ─────────────────────────────────────────────────────
  const EMAIL_TRIGGERS: Partial<Record<string, "approved" | "declined" | "needs_info" | "cancelled" | "proposal_sent" | "pending_documents" | "pending_payment">> = {
    "Proposal Sent":     "proposal_sent",
    "Needs Info":        "needs_info",
    "Pending Documents": "pending_documents",
    "Pending Payment":   "pending_payment",
    "Deposit Received":  "approved",
    Confirmed:           "approved",
    Declined:            "declined",
    "Cancelled by BX":   "cancelled",
    "Completed":         undefined,
    "Cancelled by User": undefined, // user-initiated — no email back to user
    Expired:             undefined,
  };

  // If a confirmed/approved reservation is being declined, send "cancelled" not "declined"
  const activeStatuses = ["approved", "confirmed", "completed"];
  let emailType = EMAIL_TRIGGERS[status] as typeof EMAIL_TRIGGERS[string];
  if (emailType === "declined" && activeStatuses.includes(prevDbStatus)) {
    emailType = "cancelled";
  }

  // For Proposal Sent — auto-create a facility use agreement and include the link
  let agreementUrl: string | undefined;
  if (emailType === "proposal_sent") {
    try {
      const payload  = (row.payload ?? {}) as Record<string, unknown>;
      const days     = (payload.days as Record<string, unknown>[]) ?? [];
      const firstDay = (days[0] ?? {}) as Record<string, unknown>;
      const dateStr  = (firstDay.date as string) ?? "";
      const summary  = `${row.event_name as string}${dateStr ? " — " + dateStr : ""}`;
      const svcUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bx.brainerdhq.app";
      const agmtRes  = await fetch(`${svcUrl}/api/agreements`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          reservation_id:      row.id as string,
          reservation_summary: summary,
          contact_name:        (row.contact_name as string) || (row.contact_email as string),
        }),
      });
      if (agmtRes.ok) {
        const agmtData = (await agmtRes.json()) as { token?: string };
        if (agmtData.token) {
          agreementUrl = `${svcUrl}/agree/${agmtData.token}`;
          console.log(`[agreements] created for ${row.booking_number as string}: ${agreementUrl}`);
        }
      } else {
        const errText = await agmtRes.text();
        console.warn("[agreements] failed to create:", errText);
        return NextResponse.json({ error: "Failed to create facility use agreement — proposal not sent." }, { status: 502 });
      }
    } catch (err) {
      console.warn("[agreements] error creating:", err);
      return NextResponse.json({ error: "Failed to create facility use agreement — proposal not sent." }, { status: 502 });
    }
  }

  if (emailType && row.contact_email) {
    sendStatusUpdateEmail({
      to:            row.contact_email as string,
      name:          (row.contact_name as string) || (row.contact_email as string),
      bookingNumber: row.booking_number as string,
      reservationId: row.id as string,
      eventName:     row.event_name as string,
      newStatus:     emailType,
      adminNote:     note,
      agreementUrl,
    }).then(() => {
      console.log(`[email] status-update(${emailType}) sent OK for ${row.booking_number as string}`);
    }).catch(err => {
      console.error(`[email] status-update(${emailType}) FAILED for ${row.booking_number as string}:`, err);
    });
  }

  // ── In-app bell notification for the reservation owner ───────────────────
  const NOTIF_LABEL: Partial<Record<string, { title: string; body: string }>> = {
    "Proposal Sent":    { title: "Proposal ready for your reservation", body: `A proposal has been prepared for ${row.event_name as string} (${row.booking_number as string}). Please review and sign.` },
    "Needs Info":       { title: "Your BX reservation needs attention", body: `The BX team has a follow-up question about ${row.event_name as string} (${row.booking_number as string}).` },
    "Pending Documents":{ title: "Documents required", body: `Please upload the required documents for ${row.event_name as string} (${row.booking_number as string}) to proceed.` },
    "Pending Payment":  { title: "Payment required", body: `Your reservation for ${row.event_name as string} (${row.booking_number as string}) is pending payment.` },
    "Deposit Received": { title: "Deposit received — almost there!", body: `We received your deposit for ${row.event_name as string} (${row.booking_number as string}).` },
    Confirmed:          { title: "Your reservation is confirmed!", body: `${row.event_name as string} (${row.booking_number as string}) has been confirmed.` },
    Declined:           { title: "Reservation update", body: `Your request for ${row.event_name as string} (${row.booking_number as string}) could not be accommodated.` },
    "Cancelled by BX":  { title: "Reservation cancelled", body: `Your reservation for ${row.event_name as string} (${row.booking_number as string}) has been cancelled.` },
  };
  const notifCopy = NOTIF_LABEL[status];
  if (notifCopy && row.user_id) {
    (async () => {
      try {
        const { error: nErr } = await supabase.from("bx_notifications").insert({
          user_id:        row.user_id as string,
          reservation_id: dbId,
          type:           "status_update",
          title:          notifCopy.title,
          body:           notifCopy.body,
        });
        if (nErr) console.error("[notif] insert error:", nErr);
        else console.log(`[notif] status_update inserted for ${row.booking_number as string}`);
      } catch (err) {
        console.error("[notif] unexpected error:", err);
      }
    })();
  }

  return NextResponse.json({ ok: true, dbStatus });
}
