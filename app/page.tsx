import Link from "next/link";
import Image from "next/image";
import { getUserAndRole } from "@/lib/get-user-role";

export default async function Home() {
  const { user } = await getUserAndRole();

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Hero ── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-12 sm:py-20 text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/bx-logo.png"
              alt="BX Community Center"
              width={72}
              height={72}
              className="rounded-2xl shadow-sm"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#00205B] leading-tight mb-3">
            BX Community Center
          </h1>
          <p className="text-base sm:text-lg text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
            Reserve a space for your event, meeting, or gathering — right here.
          </p>

          {user ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#00abc9] text-white font-semibold text-base shadow-sm hover:bg-[#0099b5] active:scale-[0.98] transition-all"
              >
                Reserve a Space →
              </Link>
              <Link
                href="/account"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl border border-gray-200 text-gray-700 font-medium text-base hover:bg-gray-50 transition-colors"
              >
                My Reservations
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#00abc9] text-white font-semibold text-base shadow-sm hover:bg-[#0099b5] active:scale-[0.98] transition-all"
              >
                Reserve a Space →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl border border-gray-200 text-gray-700 font-medium text-base hover:bg-gray-50 transition-colors"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Spaces overview ── */}
      <section className="max-w-2xl mx-auto px-5 py-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5 text-center">
          Available spaces
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SPACES.map((s) => (
            <div
              key={s.name}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3"
            >
              <div className="text-2xl shrink-0 mt-0.5">{s.emoji}</div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/reserve"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00abc9] hover:underline"
          >
            Check availability and reserve →
          </Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">
            How it works
          </h2>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5"
                  style={{ background: "#00205B" }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{s.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center py-8 text-xs text-gray-400">
        BX Community Center · Brainerd Baptist Church
      </footer>
    </main>
  );
}

const SPACES = [
  { emoji: "🏟️", name: "The Crossing", desc: "Large auditorium-style main event space" },
  { emoji: "🪜", name: "The Loft", desc: "Flexible upper-level meeting area" },
  { emoji: "🔤", name: "Crosspointe A / B / C", desc: "Configurable breakout rooms (can combine)" },
  { emoji: "👁️", name: "Crossview", desc: "Intimate gathering or overflow space" },
  { emoji: "🔗", name: "Crossties A / B / C", desc: "Small group & classroom rooms" },
  { emoji: "☕", name: "Crossties Café", desc: "Coffee & community space for smaller groups" },
];

const STEPS = [
  { title: "Tell us about your event", desc: "Share your name, organization, and event details." },
  { title: "Choose your space & dates", desc: "Pick rooms and time blocks — we'll show live availability." },
  { title: "Submit your request", desc: "Our team reviews and confirms. You'll hear back by email." },
];
