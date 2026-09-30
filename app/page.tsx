import Link from "next/link";
import Image from "next/image";
import { getUserAndRole } from "@/lib/get-user-role";
import StaffPhoto from "@/app/components/StaffPhoto";

export default async function Home() {
  const { user, profile } = await getUserAndRole();

  // Derive a first name for the personalized greeting
  const firstName = profile?.display_name
    ? profile.display_name.split(" ")[0]
    : null;

  return (
    <main className="min-h-screen">

      {/* ── Hero ── */}
      <section className="bx-band border-b relative overflow-hidden">
        <div className="bx-bloom" aria-hidden="true" />
        <div className="relative max-w-2xl mx-auto px-5 pt-12 pb-14 sm:pt-20 sm:pb-20 text-center animate-in">
          <div className="flex justify-center mb-5">
            <Image
              src="/bx-logo-black.png"
              alt="BX Community Center"
              width={68}
              height={68}
              className="rounded-2xl shadow-lg ring-1 ring-parchment/10"
              priority
            />
          </div>

          {user ? (
            <>
              <p className="bx-eyebrow mb-4">
                Welcome back{firstName ? `, ${firstName}` : ""}
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold text-parchment leading-[1.05] mb-4">
                BX Reservations
              </h1>
              <p className="text-base sm:text-[1.1rem] text-slate mb-8 max-w-md mx-auto leading-relaxed">
                Reserve a space at the BX Community Center for your event, meeting, class, or gathering.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/reserve"
                  className="bx-cta inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-brass text-white font-bold text-base active:scale-[0.98]"
                >
                  Reserve a Space →
                </Link>
                <Link
                  href="/reservations"
                  className="bx-glass-flat inline-flex items-center justify-center px-7 py-4 rounded-xl text-parchment font-semibold text-base hover:border-brass/40 transition-colors"
                >
                  My Reservations
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="bx-eyebrow mb-4">BX Community Center</p>
              <h1 className="text-4xl sm:text-5xl font-bold text-parchment leading-[1.05] mb-4">
                Welcome to BX Reservations
              </h1>
              <p className="text-base sm:text-[1.1rem] text-slate mb-8 max-w-md mx-auto leading-relaxed">
                Reserve a space at the BX Community Center for your event, meeting, class, or gathering.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/reserve"
                  className="bx-cta inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-brass text-white font-bold text-base active:scale-[0.98]"
                >
                  Reserve a Space →
                </Link>
                <Link
                  href="/login"
                  className="bx-glass-flat inline-flex items-center justify-center px-7 py-4 rounded-xl text-parchment font-semibold text-base hover:border-brass/40 transition-colors"
                >
                  Sign in / Sign up
                </Link>
              </div>
              <p className="text-xs text-slate mt-4 opacity-70">
                No account required to submit — sign in after to track your request.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Account value prop (only show if not signed in) ── */}
      {!user && (
        <section className="max-w-2xl mx-auto px-5 pt-8">
          <div
            className="bx-glass rounded-2xl px-6 py-5 flex items-start gap-4"
            style={{
              background: "color-mix(in srgb, var(--bx-brass) 9%, var(--bx-surface))",
              borderColor: "color-mix(in srgb, var(--bx-brass) 30%, transparent)",
            }}
          >
            <div className="shrink-0 mt-0.5" style={{color:"var(--bx-brass)"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
            </div>
            <div>
              <p className="font-semibold text-sm mb-1" style={{ color: "var(--bx-parchment)" }}>
                Your Google account is your BX account
              </p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--bx-slate)" }}>
                Sign in with Google once and your name, email, and phone pre-fill every future request automatically. Track your reservation from Pending all the way to Confirmed — no separate sign-up form, no new password.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "var(--bx-brass)", background: "color-mix(in srgb, var(--bx-brass) 14%, transparent)" }}
              >
                Sign in with Google →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Spaces overview ── */}
      <section className="max-w-2xl mx-auto px-5 py-9 bx-fade-in">
        <h2 className="bx-eyebrow mb-5">
          Available spaces
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SPACES.map((s) => (
            <Link
              key={s.name}
              href={`/rooms#${s.roomId}`}
              className="relative rounded-xl overflow-hidden border border-parchment/10 h-28 block group shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <Image
                src={s.image}
                alt={s.name}
                fill
                sizes="(max-width:640px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10 group-hover:from-black/90 transition-colors duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="font-semibold text-white text-sm leading-tight">{s.name}</div>
                <div className="text-[11px] text-white/70 mt-0.5 leading-snug">{s.desc}</div>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-[10px] font-bold text-white/80 bg-black/40 px-2 py-0.5 rounded-full">View photos →</span>
              </div>
            </Link>
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
      <section className="bx-band border-y bx-fade-in">
        <div className="max-w-2xl mx-auto px-5 py-9">
          <h2 className="bx-eyebrow mb-6">
            How it works
          </h2>
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5 tabular"
                  style={{ background: "var(--bx-brass)", boxShadow: "0 0 0 4px color-mix(in srgb, var(--bx-brass) 14%, transparent), 0 4px 12px -2px color-mix(in srgb, var(--bx-brass) 50%, transparent)" }}
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
      <section className="max-w-2xl mx-auto px-5 py-9 bx-fade-in">
        <h2 className="bx-eyebrow mb-6">
          Questions? We&#39;re here to help
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Barb */}
          <div className="bx-glass rounded-2xl p-5 flex flex-col items-center text-center">
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
          <div className="bx-glass rounded-2xl p-5 flex flex-col items-center text-center">
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

const U = (id: string) =>
  `https://images.unsplash.com/${id}?w=600&q=80&fit=crop&auto=format`;

const SPACES = [
  { name: "The Crossing", desc: "Large auditorium-style main event space", image: U("photo-1519167758481-83f550bb49b3"), roomId: "crossing" },
  { name: "The Loft", desc: "Flexible upper-level meeting area", image: U("photo-1497366216548-37526070297c"), roomId: "loft" },
  { name: "Crosspointe A / B / C", desc: "Configurable breakout rooms — use one or combine all three", image: U("photo-1568992687947-868a62a9f521"), roomId: "crosspointe-a" },
  { name: "Crossview", desc: "Intimate gathering or overflow space", image: U("photo-1580582932707-520aed937b7b"), roomId: "crossview" },
  { name: "Crossties A / B / C", desc: "Small group & classroom rooms", image: U("photo-1517502884422-41eaead166d4"), roomId: "crosstiesA" },
  { name: "Crossties Café", desc: "Coffee & community space for smaller groups", image: U("photo-1554118811-1e0d58224f24"), roomId: "crosstiescafe" },
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
    title: "Track your reservation online",
    desc: "As part of submitting, you'll sign in with Google — it takes seconds, and means you can follow your reservation from Pending all the way to Confirmed.",
  },
  {
    title: "We review and confirm",
    desc: "Our team will follow up with next steps and any questions. Expect a response within 1–2 business days.",
  },
];
