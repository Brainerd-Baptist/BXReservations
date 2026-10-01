// Add-on pricing (v1.59): room-only items and the hour-tiered AV package.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- run by tsx as CommonJS
const { tierPrice, addonLines, addonTotal, addonApplies } = require("../lib/addon-pricing");

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};
const av = { type: "hours_tier", tiers: [[4, 425], [8, 525]], extra_hour: 40 };
eq("AV 3 hrs", tierPrice(av, 3), 425);
eq("AV 4 hrs", tierPrice(av, 4), 425);
eq("AV 6 hrs", tierPrice(av, 6), 525);
eq("AV 8 hrs", tierPrice(av, 8), 525);
eq("AV 10 hrs", tierPrice(av, 10), 605);
eq("AV 8h15m → half hour", tierPrice(av, 8.25), 545);
eq("AV all day (14 hrs)", tierPrice(av, 14), 765);

const pkg = { id: "p", name: "Complete AV package", unit: "per_day", price: 425, rooms: ["crossing"], pricing: av };
const uhf = { id: "u", name: "UHF wireless microphone", unit: "each", price: 125, rooms: ["crossing"], pricing: null };
const cloth = { id: "c", name: "Black linen tablecloth", unit: "each", price: 13, rooms: null, pricing: null };
const loftAv = { id: "l", name: "AV setup — The Loft", unit: "flat", price: 75, rooms: ["loft"], pricing: null };
const crossingDay = { date: "2026-10-03", included: true, timeSlot: "afternoon", rooms: [{ roomId: "crossing" }] };
const loftDay = { date: "2026-10-04", included: true, timeSlot: "morning", rooms: [{ roomId: "loft" }] };

eq("UHF needs the Crossing", addonApplies(uhf, [loftDay]), false);
eq("UHF with Crossing ×2", addonTotal(uhf, 2, [crossingDay]), 250);
eq("tablecloths ×10 anywhere", addonTotal(cloth, 10, [loftDay]), 130);
eq("Loft AV is per event", addonTotal(loftAv, 3, [loftDay]), 75);
eq("AV package only on Crossing days", addonLines(pkg, 1, [crossingDay, loftDay]).length, 1);
eq("AV package afternoon (5 hrs)", addonTotal(pkg, 1, [crossingDay, loftDay]), 525);
eq("AV package day label", addonLines(pkg, 1, [crossingDay])[0].label, "Complete AV package · Sat, Oct 3 · 5 hrs");
eq("church use is free", addonTotal(uhf, 1, [crossingDay], true), 0);
eq("skipped days don't count", addonLines(pkg, 1, [{ ...crossingDay, included: false }]).length, 0);
if (fail) { console.error(`${fail} add-on pricing test(s) failed`); process.exit(1); }
console.log("All add-on pricing tests passed");
