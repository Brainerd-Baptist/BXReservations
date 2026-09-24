import { getUserAndRole } from "@/lib/get-user-role";
import HeaderShell from "./components/header-shell";

export default async function SiteHeader() {
  const { user, role, profile } = await getUserAndRole();

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user
    ? user.email
        .split("@")[0]
        .split(/[._-]/)
        .map((p: string) => p[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("")
    : "";

  return (
    <HeaderShell
      initials={initials}
      role={role}
      hasUser={!!user}
    />
  );
}
