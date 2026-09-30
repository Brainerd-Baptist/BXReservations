import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import HeaderShell from "./components/header-shell";

export default async function SiteHeader() {
  const { user, role, profile, theme } = await getUserAndRole();

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

  const savedTheme: string | null = theme ?? null;

  // Every account needs a name (bookings and agreements use it). Google
  // usually provides one; if not, nudge until they add it.
  const needsName = !!user && !profile?.display_name;

  return (
    <>
    <HeaderShell
      initials={initials}
      role={role}
      hasUser={!!user}
      userId={user?.id}
      email={user?.email}
      displayName={profile?.display_name ?? null}
      savedTheme={savedTheme}
    />
    {needsName && (
      <div role="status" className="bx-name-banner bx-tone-amber border-b text-sm">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <span>Add your full name to finish setting up your account.</span>
          <Link href="/account#profile" className="bx-btn bx-btn--primary bx-btn--sm">Add name</Link>
        </div>
      </div>
    )}
    </>
  );
}
