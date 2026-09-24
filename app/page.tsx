import Link from "next/link";
import Image from "next/image";
import { getUserAndRole } from "@/lib/get-user-role";
import StaffPhoto from "@/app/components/StaffPhoto";

export default async function Home() {
  const { user } = await getUserAndRole();

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Hero ── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 pt-10 pb-12 sm:pt-16 sm:pb-16 text-center">
          <div className="flex justify-center mb-5">
            <Image
              src="/bx-logo.png"
              alt="BX Community Center"
              width={68}
              height={68}
              className="rounded-2xl shadow-sm"
              priority
            />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-[#00205B] leading-tight mb-2">
            Welcome to BX Reservations
          </h1>
          <p className="text-base sm:text-[1.1rem] text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
            Reserve a space at the BX Community Center for your event, meeting, class, or gathering.
          </p>

          {user ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#00abc9] text-white font-bold text-base shadow-sm hover:bg-[#0099b5] active:scale-[0.98] transition-all"
              >
                Reserve a Space →
              </Link>
              <Link
                href="/account"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl border border-gray-200 text-gray-700 font-semibold text-base hover:bg-gray-50 transition-colors"
              >
                My Reservations
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#00abc9] text-white font-bold text-base shadow-sm hover:bg-[#0099b5] active:scale-[0.98] transition-all"
              >
                Reserve a Space →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl border border-gray-200 text-gray-700 font-semibold text-base hover:bg-gray-50 transition-colors"
              >
                Sign in / Sign up
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Account value prop (only show if not signed in) ── */}
      {!user && (
        <section className="max-w-2xl mx-auto px-5 pt-8">
          <div className="bg-[#00205B] rounded-2xl px-6 py-5 flex items-start gap-4">
            <div className="text-2xl shrink-0 mt-0.5">🔐</div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">
                Create a free account to get the most out of BX Reservations
              </p>
              <p className="text-blue-200 text-xs leading-relaxed mb-3">
                Sign in with Google to save your progress as you go, submit your request with one tap, and follow your reservation status — from Pending all the way to Confirmed — right here online.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-lg"
              >
                Create your account →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Spaces overview ── */}
      <section className="max-w-2xl mx-auto px-5 py-9">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 text-center">
          Available spaces
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SPACES.map((s) => (
            <div
              key={s.name}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-7 text-center">
          <Link
            href="/reserve"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00abc9] hover:underline"
          >
            Check availability and make a request →
          </Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-9">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">
            How it works
          </h2>
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5"
                  style={{ background: "#00abc9" }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{s.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Meet the team ── */}
      <section className="max-w-2xl mx-auto px-5 py-9">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">
          Questions? We&#39;re here to help
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Barb */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col items-center text-center">
            <div className="mb-3">
              <StaffPhoto
                thumbSrc="/staff/barb.jpg"
                fullSrc="/staff/barb-full.jpg"
                name="Barb"
                size={80}
              />
            </div>
            <div className="font-bold text-gray-900 text-sm">Barb</div>
            <div className="text-[11px] text-gray-400 mb-3">BX Coordinator</div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Pricing, setup requests, and anything specific to your event.
            </p>
            <a
              href="mailto:barb@brainerdbaptist.org"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00abc9] hover:underline"
            >
              Contact Barb →
            </a>
          </div>
          {/* Jo */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col items-center text-center">
            <div className="mb-3">
              <StaffPhoto
                thumbSrc="/staff/jo.jpg"
                fullSrc="/staff/jo-full.jpg"
                name="Jo"
                size={80}
              />
            </div>
            <div className="font-bold text-gray-900 text-sm">Jo</div>
            <div className="text-[11px] text-gray-400 mb-3">BX Director</div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              General questions about the BX, partnerships, or larger events.
            </p>
            <a
              href="mailto:jo@brainerdbaptist.org"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00abc9] hover:underline"
            >
              Contact Jo →
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center pb-10 text-xs text-gray-400">
        BX Community Center · Brainerd Baptist Church
      </footer>
    </main>
  );
}

const SPACES = [
  { name: "The Crossing", desc: "Large auditorium-style main event space" },
  { name: "The Loft", desc: "Flexible upper-level meeting area" },
  { name: "Crosspointe A / B / C", desc: "Configurable breakout rooms — use one or combine all three" },
  { name: "Crossview", desc: "Intimate gathering or overflow space" },
  { name: "Crossties A / B / C", desc: "Small group & classroom rooms" },
  { name: "Crossties Café", desc: "Coffee & community space for smaller groups" },
];

const STEPS = [
  {
    title: "Tell us about your event",
    desc: "Share your name, organization, event type, and expected headcount.",
  },
  {
    title: "Choose your space and dates",
    desc: "Pick rooms and time blocks — we'll show live availability from our calendar.",
  },
  {
    title: "Create an account to submit",
    desc: "Sign in with Google to submit your request and track your status online from Pending to Confirmed.",
  },
  {
    title: "We review and confirm",
    desc: "Our team will follow up with next steps and any questions. Expect a response within 1–2 business days.",
  },
];
