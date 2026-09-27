// Server-side role gate — only booking_admin and above can access the admin panel.
import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await getUserAndRole();

  if (!user) redirect("/login");
  if (!can.viewAdminPanel(role)) redirect("/account");

  return <>{children}</>;
}
