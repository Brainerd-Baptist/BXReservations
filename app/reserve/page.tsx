import { getUserAndRole } from "@/lib/get-user-role";
import ReserveClient from "./reserve-client";

export default async function ReservePage() {
  const { user, profile } = await getUserAndRole();

  const initialContact = user
    ? {
        name: profile?.display_name ?? "",
        email: user.email,
        phone: profile?.phone ?? "",
        org: profile?.organization ?? "",
      }
    : undefined;

  return <ReserveClient initialContact={initialContact} userId={user?.id ?? null} />;
}
