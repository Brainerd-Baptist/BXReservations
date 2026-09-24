import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserAndRole } from "@/lib/get-user-role";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

export const metadata = { title: "My Account · BX Reservations" };

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending:   { label: "Pending",   className: "bg-yellow-100 text-yellow-800" },
    approved:  { label: "Approved",  className: "bg-green-100 text-green-800"  },
    rejected:  { label: "Rejected",  className: "bg-red-100 text-red-800"      },
    cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-500"    },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

export default async function AccountPage() {
  const { user, role } = await getUserAndRole();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, space, event_date, event_name, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const initials = user.email
    .split("@")[0]
    .split(/[._-]/)
    .map((p: string) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">

      {/* Profile card */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 pt-6 pb-5 flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0"
            style={{ background: "#00205B" }}
          >
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {role === "admin" ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-[#00205B] text-white">
                  Admin
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase border border-gray-300 text-gray-600">
                  User
                </span>
              )}
            </div>
          </div>
        </div>

        {role === "admin" && (
          <div className="border-t border-gray-100 px-6 py-3">
            <Link
              href="/admin/bx-reservations"
              className="text-sm font-medium text-[#00205B] hover:underline flex items-center gap-1"
            >
              Admin dashboard →
            </Link>
          </div>
        )}
      </section>

      {/* My reservations */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">My Reservations</h2>
          <Link href="/reserve" className="text-sm text-[#00abc9] hover:underline font-medium">
            + New request
          </Link>
        </div>

        {!reservations || reservations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
            <p className="text-gray-400 text-sm">No reservations yet.</p>
            <Link
              href="/reserve"
              className="mt-4 inline-flex items-center text-sm font-medium text-[#00205B] hover:underline"
            >
              Make your first reservation →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {r.event_name || r.space || "Untitled reservation"}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {r.space && r.event_name ? r.space + " · " : ""}
                    {r.event_date
                      ? new Date(r.event_date).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric", year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
                <div className="shrink-0 mt-0.5">{statusBadge(r.status ?? "pending")}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sign out */}
      <section className="pt-2">
        <SignOutButton />
      </section>
    </main>
  );
}
