import { NextResponse } from "next/server";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";

/**
 * Guards for API routes that use the service key (which skips the database's
 * row-level rules). Return a response to send back, or null to continue.
 *
 *   const denied = await requireStaff(); if (denied) return denied;
 */
export async function requireStaff(): Promise<NextResponse | null> {
  const { user, role } = await getUserAndRole();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can.approveReservations(role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  return null;
}

/** Owner or System Admin (configuration: blackouts, rooms, pricing, users). */
export async function requireSysadmin(): Promise<NextResponse | null> {
  const { user, role } = await getUserAndRole();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can.configureSystem(role)) return NextResponse.json({ error: "Owner or System Admin only" }, { status: 403 });
  return null;
}
