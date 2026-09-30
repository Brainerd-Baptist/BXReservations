import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient } from "@/lib/event-map";
import { sendBalanceReminder } from "@/lib/payment-reminders";

type Params = { params: Promise<{ id: string }> };

// POST — email the requester their current balance now
export async function POST(_req: NextRequest, { params }: Params) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  const { user } = await getUserAndRole();
  const result = await sendBalanceReminder(adminClient(), id, "manual", user?.id ?? null).catch((e) => ({
    ok: false as const, error: `Couldn't send: ${(e as Error).message}`,
  }));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
