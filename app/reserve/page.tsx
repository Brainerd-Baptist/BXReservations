"use client";
import { useState, useEffect } from "react";

// ─── Rate table (BX Room Rental Information, 2026 rev.)
const ROOMS = [
  {
    id: "crossing",
    name: "The Crossing",
    group: "Main",
    baseNonProfit: 750,
    baseProfit: 900,
    extraHourNonProfit: 100,
    extraHourProfit: 100,
    description: "Large main event space. Ideal for galas, receptions, and conferences.",
    image: "/images/rooms/crossing-11.jpg",
  },
  {
    id: "loft",
    name: "The Loft",
    group: "Main",
    baseNonProfit: 325,
    baseProfit: 500,
    extraHourNonProfit: 75,
    extraHourProfit: 75,
    description: "Versatile upper-level space. Great for mid-size events and gatherings.",
  },
  {
    id: "crosspointe-a",
    name: "CrossPointe A",
    group: "CrossPointe",
    baseNonProfit: 200,
    baseProfit: 250,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Flexible meeting/event room. Can be combined with B and C.",
  },
  {
    id: "crosspointe-b",
    name: "CrossPointe B",
    group: "CrossPointe",
    baseNonProfit: 200,
    baseProfit: 250,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Flexible meeting/event room. Can be combined with A and C.",
  },
  {
    id: "crosspointe-c",
    name: "CrossPointe C",
    group: "CrossPointe",
    baseNonProfit: 200,
    baseProfit: 250,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Flexible meeting/event room. Can be combined with A and B.",
  },
  {
    id: "crossview",
    name: "CrossView",
    group: "CrossPointe",
    baseNonProfit: 250,
    baseProfit: 300,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Windowed room with open views. Well-suited for smaller events.",
  },
  {
    id: "crosstiesA",
    name: "CrossTies A",
    group: "CrossTies",
    baseNonProfit: 125,
    baseProfit: 150,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Compact event room. Ideal for small meetings and classes.",
  },
  {
    id: "crosstiesB",
    name: "CrossTies B",
    group: "CrossTies",
    baseNonProfit: 125,
    baseProfit: 150,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Compact event room. Ideal for small meetings and classes.",
  },
  {
    id: "crosstiesC",
    name: "CrossTies C",
    group: "CrossTies",
    baseNonProfit: 125,
    baseProfit: 150,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Compact event room. Ideal for small meetings and classes.",
  },
  {
    id: "crosstiescafe",
    name: "CrossTies Café",
    group: "CrossTies",
    baseNonProfit: 175,
    baseProfit: 225,
    extraHourNonProfit: 35,
    extraHourProfit: 35,
    description: "Café-style space with casual atmosphere. Great for receptions and socials.",
  },
] as const;

type RoomId = (typeof ROOMS)[number]["id"];
type AvailabilityStatus = "available" | "ask" | "unavailable" | "loading";

const SETUPS = ["Theater", "Banquet/Rounds", "Classroom", "U-Shape"] as const;
type Setup = (typeof SETUPS)[number];

const AV_PRICE = 75;
const TABLECLOTH_PRICE = 17;

function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  if (status === "loading")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
        Checking…
      </span>
    );
  if (status === "available")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Available
      </span>
    );
  if (status === "ask")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Ask us
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Unavailable
    </span>
  );
}

function calcCost(
  rooms: readonly (typeof ROOMS)[number][],
  nonProfit: boolean,
  days: number,
  extraHours: number,
  tablecloths: number,
  avNeeded: boolean
): number {
  const roomTotal = rooms.reduce((sum, room) => {
    const base = nonProfit ? room.baseNonProfit : room.baseProfit;
    const extra = (nonProfit ? room.extraHourNonProfit : room.extraHourProfit) * extraHours;
    return sum + (base + extra) * days;
  }, 0);
  return roomTotal + tablecloths * TABLECLOTH_PRICE + (avNeeded ? AV_PRICE : 0);
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  org: string;
  nonProfit: boolean;
  eventName: string;
  eventDate: string;
  days: number;
  startTime: string;
  endTime: string;
  guestCount: string;
  roomIds: RoomId[];
  setup: Setup;
  tablecloths: number;
  avNeeded: boolean;
  extraHours: number;
  policyAgreed: boolean;
}

const INITIAL: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  org: "",
  nonProfit: false,
  eventName: "",
  eventDate: "",
  days: 1,
  startTime: "",
  endTime: "",
  guestCount: "",
  roomIds: [],
  setup: "Theater",
  tablecloths: 0,
  avNeeded: false,
  extraHours: 0,
  policyAgreed: false,
};

const STEPS = ["Your Info", "Event Details", "Setup & Extras", "Policies", "Review"];

const ROOM_GROUPS = [
  { label: "Main Spaces", ids: ["crossing", "loft"] },
  { label: "CrossPointe Rooms", ids: ["crosspointe-a", "crosspointe-b", "crosspointe-c", "crossview"] },
  { label: "CrossTies Rooms", ids: ["crosstiesA", "crosstiesB", "crosstiesC", "crosstiescafe"] },
] as const;

export default function ReservePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleRoom = (id: RoomId) => {
    setForm((f) => ({
      ...f,
      roomIds: f.roomIds.includes(id)
        ? f.roomIds.filter((r) => r !== id)
        : [...f.roomIds, id],
    }));
  };

  useEffect(() => {
    if (!form.eventDate) {
      setAvailability({});
      return;
    }
    const loading: Record<string, AvailabilityStatus> = {};
    ROOMS.forEach((r) => { loading[r.id] = "loading"; });
    setAvailability(loading);

    const allIds = ROOMS.map((r) => r.id).join(",");
    fetch(`/api/availability?date=${form.eventDate}&rooms=${allIds}`)
      .then((res) => res.json())
      .then((data: Record<string, AvailabilityStatus>) => setAvailability(data))
      .catch(() => {
        const fallback: Record<string, AvailabilityStatus> = {};
        ROOMS.forEach((r) => { fallback[r.id] = "ask"; });
        setAvailability(fallback);
      });
  }, [form.eventDate]);

  const selectedRooms = ROOMS.filter((r) => form.roomIds.includes(r.id as RoomId));
  const estimatedCost = calcCost(
    selectedRooms,
    form.nonProfit,
    form.days,
    form.extraHours,
    form.tablecloths,
    form.avNeeded
  );
  const isMultiDay = form.days > 1;
  const isMultiRoom = form.roomIds.length > 1;

  const canNext = () => {
    if (step === 0) return form.firstName && form.lastName && form.email;
    if (step === 1) return form.eventName && form.eventDate && form.roomIds.length > 0;
    if (step === 2) return true;
    if (step === 3) return form.policyAgreed;
    return true;
  };

  if (submitted) {
    const ref = `BX-${Date.now().toString(36).toUpperCase()}`;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Received</h1>
          <p className="text-gray-500 mb-1">Reference number</p>
          <p className="text-lg font-mono font-bold text-[var(--bbc-blue)] mb-6">{ref}</p>
          <p className="text-sm text-gray-600 mb-8">
            We&apos;ll review your request and follow up at <strong>{form.email}</strong> within
            2 business days to confirm availability and next steps.
          </p>
          <a href="/" className="btn-primary">Back to BX</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <p className="text-xs font-semibold text-[var(--bbc-blue)] tracking-widest uppercase">BX Crossroads</p>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Reserve a Space</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_280px] gap-8">
        <div>
          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < step
                        ? "bg-[var(--bbc-blue)] text-white"
                        : i === step
                        ? "bg-[var(--bbc-navy)] text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {i < step ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-xs mt-1 whitespace-nowrap hidden sm:block ${i === step ? "text-gray-900 font-semibold" : "text-gray-400"}`}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-8 sm:w-12 mx-1 mb-4 ${i < step ? "bg-[var(--bbc-blue)]" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">

            {/* Step 0: Your Info */}
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-gray-900">Your Information</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="First name" required>
                    <input className={inp} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  </Field>
                  <Field label="Last name" required>
                    <input className={inp} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                  </Field>
                </div>
                <Field label="Email" required>
                  <input className={inp} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className={inp} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="Organization or group name">
                  <input className={inp} value={form.org} onChange={(e) => set("org", e.target.value)} placeholder="Leave blank if personal" />
                </Field>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-gray-300 text-[var(--bbc-blue)]"
                    checked={form.nonProfit}
                    onChange={(e) => set("nonProfit", e.target.checked)}
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">We are a registered non-profit (501(c)(3))</p>
                    <p className="text-xs text-gray-500 mt-0.5">Non-profit rates apply — proof of status may be requested.</p>
                  </div>
                </label>
              </div>
            )}

            {/* Step 1: Event Details */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-gray-900">Event Details</h2>
                <Field label="Event name" required>
                  <input className={inp} value={form.eventName} onChange={(e) => set("eventName", e.target.value)} placeholder="e.g. Company Holiday Party" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Start date" required>
                    <input className={inp} type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
                  </Field>
                  <Field label="Approximate guest count">
                    <input className={inp} type="number" min={1} value={form.guestCount} onChange={(e) => set("guestCount", e.target.value)} />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Start time">
                    <input className={inp} type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
                  </Field>
                  <Field label="End time">
                    <input className={inp} type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
                  </Field>
                </div>

                {/* Number of days */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Number of Days</p>
                  <p className="text-xs text-gray-500 mb-2">For multi-day events, final pricing is confirmed by our team.</p>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                      onClick={() => set("days", Math.max(1, form.days - 1))}>−</button>
                    <span className="w-8 text-center font-semibold">{form.days}</span>
                    <button type="button"
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                      onClick={() => set("days", form.days + 1)}>+</button>
                    <span className="text-sm text-gray-500">{form.days === 1 ? "day" : "days"}</span>
                  </div>
                </div>

                {/* Room picker */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Rooms <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    Select all spaces you need. Base rate = 4-hour block per room. Setup, teardown, and trash removal included.
                  </p>
                  {form.roomIds.length > 0 && (
                    <p className="text-xs font-semibold text-[var(--bbc-blue)] mb-3">
                      {form.roomIds.length} room{form.roomIds.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                  <div className="space-y-4">
                    {ROOM_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{group.label}</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {group.ids.map((id) => {
                            const room = ROOMS.find((r) => r.id === id)!;
                            const avail: AvailabilityStatus = availability[room.id] ?? "available";
                            const selected = form.roomIds.includes(room.id as RoomId);
                            const isUnavailable = avail === "unavailable";
                            return (
                              <button
                                key={room.id}
                                type="button"
                                onClick={() => !isUnavailable && toggleRoom(room.id as RoomId)}
                                disabled={isUnavailable}
                                className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                                  isUnavailable
                                    ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                                    : selected
                                    ? "border-[var(--bbc-blue)] bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                {selected && (
                                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--bbc-blue)] flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                                {"image" in room && (
                                  <div className="-mx-4 -mt-4 mb-3 rounded-t-xl overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={(room as typeof room & { image: string }).image}
                                      alt={room.name}
                                      className="w-full h-28 object-cover object-center"
                                    />
                                  </div>
                                )}
                                <p className="font-semibold text-sm text-gray-900 pr-6">{room.name}</p>
                                <p className="text-xs text-gray-500 mt-1 mb-2">{room.description}</p>
                                <p className="text-xs text-[var(--bbc-blue)] font-semibold">
                                  ${room.baseNonProfit.toLocaleString()} NP &nbsp;·&nbsp; ${room.baseProfit.toLocaleString()} standard
                                  <span className="text-gray-400 font-normal"> (4 hrs)</span>
                                </p>
                                {form.eventDate && (
                                  <div className="mt-2">
                                    <AvailabilityBadge status={avail} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Setup & Extras */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Setup & Extras</h2>
                <p className="text-sm text-gray-500 -mt-2">
                  Table/chair setup and teardown are included in your rental. Let us know your preferred layout and any add-ons.
                </p>
                {selectedRooms.length > 0 && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                    <span className="font-semibold">Selected rooms:</span>{" "}
                    {selectedRooms.map((r) => r.name).join(", ")}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Preferred Room Layout</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SETUPS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set("setup", s)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          form.setup === s ? "border-[var(--bbc-blue)] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className="font-semibold text-sm text-gray-900">{s}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Tablecloths</p>
                  <p className="text-xs text-gray-500 mb-2">${TABLECLOTH_PRICE} each</p>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                      onClick={() => set("tablecloths", Math.max(0, form.tablecloths - 1))}>−</button>
                    <span className="w-8 text-center font-semibold">{form.tablecloths}</span>
                    <button type="button"
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                      onClick={() => set("tablecloths", form.tablecloths + 1)}>+</button>
                    {form.tablecloths > 0 && (
                      <span className="text-sm text-gray-500">${(form.tablecloths * TABLECLOTH_PRICE).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 rounded border-gray-300"
                    checked={form.avNeeded} onChange={(e) => set("avNeeded", e.target.checked)} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">A/V Package — ${AV_PRICE}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Projector, screen, PA system, and basic microphone setup.</p>
                  </div>
                </label>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Extra Hours</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Beyond the 4-hour base window{isMultiRoom ? " (applied per room)" : ""}
                  </p>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                      onClick={() => set("extraHours", Math.max(0, form.extraHours - 1))}>−</button>
                    <span className="w-8 text-center font-semibold">{form.extraHours}</span>
                    <button type="button"
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                      onClick={() => set("extraHours", form.extraHours + 1)}>+</button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Policies */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-gray-900">Policies & Terms</h2>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 p-4 space-y-3 text-sm text-gray-700">
                    <Policy title="Deposit">A 50% deposit is required to confirm your reservation. The remaining balance is due 14 days before your event.</Policy>
                    <Policy title="What's Included">Your rental includes table and chair setup, teardown, and trash removal at the close of the event.</Policy>
                    <Policy title="Cancellation">Cancellations with 30+ days notice receive a full deposit refund. Cancellations within 30 days forfeit the deposit. Cancellations within 7 days are charged the full rental fee.</Policy>
                    <Policy title="Alcohol">No alcohol is permitted on BX premises at any time.</Policy>
                    <Policy title="Capacity">You are responsible for ensuring your event does not exceed posted room capacity.</Policy>
                    {!policyExpanded && (
                      <button type="button" className="text-xs font-semibold text-[var(--bbc-blue)] hover:underline"
                        onClick={() => setPolicyExpanded(true)}>
                        Show full policy text ↓
                      </button>
                    )}
                    {policyExpanded && (
                      <>
                        <Policy title="Noise">Events must end by 11:00 PM. Amplified music and sound must comply with local noise ordinances.</Policy>
                        <Policy title="Damage">Renter is liable for any damage to the facility, furnishings, or equipment during their rental period.</Policy>
                        <Policy title="Parking">Parking is available in the BX lot. Overflow parking is the renter's responsibility to coordinate.</Policy>
                        <Policy title="Catering">Outside catering is permitted. Caterers must clean up after themselves.</Policy>
                        <button type="button" className="text-xs font-semibold text-[var(--bbc-blue)] hover:underline"
                          onClick={() => setPolicyExpanded(false)}>
                          Show less ↑
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-[var(--bbc-blue)]"
                    checked={form.policyAgreed} onChange={(e) => set("policyAgreed", e.target.checked)} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">I have read and agree to the BX rental policies</p>
                    <p className="text-xs text-gray-500 mt-0.5">Checking this box does not confirm your reservation — a staff member will follow up to finalize.</p>
                  </div>
                </label>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-gray-900">Review Your Request</h2>
                <ReviewSection title="Contact">
                  <Row label="Name" value={`${form.firstName} ${form.lastName}`} />
                  <Row label="Email" value={form.email} />
                  {form.phone && <Row label="Phone" value={form.phone} />}
                  {form.org && <Row label="Organization" value={form.org} />}
                  <Row label="Rate type" value={form.nonProfit ? "Non-profit" : "Standard"} />
                </ReviewSection>
                <ReviewSection title="Event">
                  <Row label="Event" value={form.eventName} />
                  <Row label="Start date" value={form.eventDate} />
                  <Row label="Days" value={`${form.days}`} />
                  {form.startTime && <Row label="Time" value={`${form.startTime}${form.endTime ? ` – ${form.endTime}` : ""}`} />}
                  {form.guestCount && <Row label="Guests" value={form.guestCount} />}
                  <Row label={`Room${selectedRooms.length !== 1 ? "s" : ""}`} value={selectedRooms.map((r) => r.name).join(", ")} />
                </ReviewSection>
                <ReviewSection title="Setup">
                  <Row label="Layout" value={form.setup} />
                  <Row label="Tablecloths" value={`${form.tablecloths} ($${(form.tablecloths * TABLECLOTH_PRICE).toLocaleString()})`} />
                  <Row label="A/V Package" value={form.avNeeded ? `Yes ($${AV_PRICE})` : "No"} />
                  {form.extraHours > 0 && <Row label="Extra hours" value={`${form.extraHours} hr${isMultiRoom ? " per room" : ""}`} />}
                </ReviewSection>
                <div className="rounded-xl bg-[var(--bbc-navy)] text-white p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-60 font-semibold uppercase tracking-widest">Estimated Total</p>
                    <p className="text-xs opacity-50 mt-0.5">
                      {isMultiDay || isMultiRoom
                        ? "Estimate — staff will confirm final pricing"
                        : "4-hr base · staff will confirm final pricing"}
                    </p>
                  </div>
                  <p className="text-3xl font-bold">${estimatedCost.toLocaleString()}</p>
                </div>
                {(isMultiDay || isMultiRoom) && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {isMultiDay && isMultiRoom
                      ? "Multi-room and multi-day pricing is confirmed by our team and may vary from this estimate."
                      : isMultiDay
                      ? "Multi-day pricing is confirmed by our team and may vary from this estimate."
                      : "Multi-room pricing is confirmed by our team and may vary from this estimate."}
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              {step > 0 ? (
                <button type="button" className="btn-outline" onClick={() => setStep((s) => s - 1)}>← Back</button>
              ) : <div />}
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canNext()}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continue →
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={() => setSubmitted(true)}>
                  Submit Request
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar cost estimate */}
        {step >= 1 && selectedRooms.length > 0 && (
          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Live Estimate</p>
              <div className="space-y-2 text-sm">
                {selectedRooms.map((room) => {
                  const base = form.nonProfit ? room.baseNonProfit : room.baseProfit;
                  const extra = (form.nonProfit ? room.extraHourNonProfit : room.extraHourProfit) * form.extraHours;
                  const roomTotal = (base + extra) * form.days;
                  return (
                    <div key={room.id} className="flex justify-between text-gray-700">
                      <span className="truncate pr-2">
                        {room.name}
                        {form.days > 1 && (
                          <span className="text-gray-400 text-xs"> ×{form.days}d</span>
                        )}
                      </span>
                      <span className="shrink-0">${roomTotal.toLocaleString()}</span>
                    </div>
                  );
                })}
                {form.tablecloths > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>{form.tablecloths} tablecloth{form.tablecloths !== 1 ? "s" : ""}</span>
                    <span>${(form.tablecloths * TABLECLOTH_PRICE).toLocaleString()}</span>
                  </div>
                )}
                {form.avNeeded && (
                  <div className="flex justify-between text-gray-700">
                    <span>A/V Package</span>
                    <span>${AV_PRICE}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
                  <span>Estimated total</span>
                  <span>${estimatedCost.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">Setup & teardown included. 50% deposit due at confirmation.</p>
              {(isMultiDay || isMultiRoom) && (
                <p className="text-xs text-amber-600">Final pricing confirmed by staff.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--bbc-blue)] focus:border-transparent";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Policy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-gray-800">{title}</p>
      <p className="text-gray-600">{children}</p>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
