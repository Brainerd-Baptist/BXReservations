// Server-side role gate — non-admins are redirected before the client
// component ever renders. Belt-and-suspenders on top of the nav sidebar
// conditional rendering.
import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await getUserAndRole();

  if (!user) redirect("/login");
  if (role !== "admin") redirect("/account");

  return <>{children}</>;
}
