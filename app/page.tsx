import Link from "next/link";
import Image from "next/image";
import { getUserAndRole } from "@/lib/get-user-role";
import StaffPhoto from "@/app/components/StaffPhoto";

export default async function Home() {
  const { user } = await getUserAndRole();

  return (
    <main className="min-h-screen bg-ink">

      {/* ── Hero ── */}
      <section className="bg-ink-soft border-b border-parchment/10">
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

          <h1 className="text-3xl sm:text-4xl font-bold text-parchment leading-tight mb-2">
            Welcome to BX Reservations
          </h1>
          <p className="text-base sm:text-[1.1rem] text-slate mb-8 max-w-md mx-auto leading-relaxed">
            Reserve a space at the BX Community Center for your event, meeting, class, or gathering.
          </p>

          {user ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-brass text-white font-bold text-base shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Reserve a Space →
              </Link>
              <Link
                href="/account"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl border border-parchment/20 text-parchment font-semibold text-base hover:bg-parchment/10 transition-colors"
              >
                My Reservations
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-brass text-white font-bold text-base shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Reserve a Space →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl border border-parchment/20 text-parchment font-semibold text-base hover:bg-parchment/10 transition-colors"
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
          <div
            className="rounded-2xl px-6 py-5 flex items-start gap-4"
            style={{ background: "var(--bx-parchment)" }}
          >
            <div className="text-2xl shrink-0 mt-0.5">🔐</div>
            <div>
              <p className="font-semibold text-sm mb-1" style={{ color: "var(--bx-ink)" }}>
                Create a free account to get the most out of BX Reservations
              </p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "color-mix(in srgb, var(--bx-ink) 70%, transparent)" }}>
                Sign in with Google to save your progress as you go, submit your request with one tap, and follow your reservation status — from Pending all the way to Confirmed — right here online.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "var(--bx-ink)", background: "color-mix(in srgb, var(--bx-ink) 15%, transparent)" }}
              >
                Create your account →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Spaces overview ── */}
      <section className="max-w-2xl mx-auto px-5 py-9">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate mb-4 text-center">
          Available spaces
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SPACES.map((s) => (
            <div
              key={s.name}
              className="bg-ink-soft rounded-xl border border-parchment/10 p-4"
            >
              <div className="font-semibold text-parchment text-sm">{s.name}</div>
              <div className="text-xs text-slate mt-0.5 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-7 text-center flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/rooms"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-parchment hover:underline"
          >
            Browse all spaces with photos →
          </Link>
          <span className="text-slate text-xs hidden sm:inline">·</span>
          <Link
            href="/reserve"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brass hover:underline"
          >
            Check availability and reserve →
          </Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-ink-soft border-t border-parchment/10">
        <div className="max-w-2xl mx-auto px-5 py-9">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate mb-6 text-center">
            How it works
          </h2>
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5"
                  style={{ background: "var(--bx-brass)" }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold text-parchment text-sm">{s.title}</div>
                  <div className="text-xs text-slate mt-0.5 leading-relaxed">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Meet the team ── */}
      <section className="max-w-2xl mx-auto px-5 py-9">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate mb-6 text-center">
          Questions? We&#39;re here to help
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Barb */}
          <div className="bg-ink-soft border border-parchment/10 rounded-2xl p-5 flex flex-col items-center text-center">
            <div className="mb-3">
              <StaffPhoto
                thumbSrc="/staff/barb.jpg"
                fullSrc="/staff/barb-full.jpg"
                name="Barb"
                size={80}
              />
            </div>
            <div className="font-bold text-parchment text-sm">Barb</div>
            <div className="text-[11px] text-slate mb-3">BX Coordinator</div>
            <p className="text-xs text-slate leading-relaxed mb-4">
              Pricing, setup requests, and anything specific to your event.
            </p>
            <a
              href="mailto:barb@brainerdbaptist.org"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brass hover:underline"
            >
              Contact Barb →
            </a>
          </div>
          {/* Jo */}
          <div className="bg-ink-soft border border-parchment/10 rounded-2xl p-5 flex flex-col items-center text-center">
            <div className="mb-3">
              <StaffPhoto
                thumbSrc="/staff/jo.jpg"
                fullSrc="/staff/jo-full.jpg"
                name="Jo"
                size={80}
              />
            </div>
            <div className="font-bold text-parchment text-sm">Jo</div>
            <div className="text-[11px] text-slate mb-3">BX Director</div>
            <p className="text-xs text-slate leading-relaxed mb-4">
              General questions about the BX, partnerships, or larger events.
            </p>
            <a
              href="mailto:jo@brainerdbaptist.org"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brass hover:underline"
            >
              Contact Jo →
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center pb-10 text-xs text-slate">
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
