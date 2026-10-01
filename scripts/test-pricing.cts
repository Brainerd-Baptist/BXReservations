// Room pricing (v1.59) — the booking page estimate and the server charges share this math.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- run by tsx as CommonJS
const { quoteRoom, dayHours, dayTotal, DEFAULT_PRICES } = require("../lib/pricing");

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};
const p = { np: 150, std: 200, extra: 25 };
eq("morning is 4 hrs", dayHours({ timeSlot: "morning" }), 4);
eq("afternoon is 5 hrs", dayHours({ timeSlot: "afternoon" }), 5);
eq("all day is 14 hrs", dayHours({ timeSlot: "any" }), 14);
eq("custom times win", dayHours({ timeSlot: "any", customStart: "09:00", customEnd: "11:30" }), 2.5);
eq("bad custom times fall back", dayHours({ timeSlot: "morning", customStart: "11:00", customEnd: "09:00" }), 4);
eq("2 hrs = block", quoteRoom(p, false, 2).amount, 200);
eq("4 hrs = block", quoteRoom(p, false, 4).amount, 200);
eq("5 hrs = block + 1 hr", quoteRoom(p, false, 5).amount, 225);
eq("4h10m rounds to half hour", quoteRoom(p, false, 4 + 10 / 60).amount, 212.5);
eq("4.5 hrs exact", quoteRoom(p, false, 4.5).amount, 212.5);
eq("non-profit 14 hrs", quoteRoom(p, true, 14).amount, 150 + 10 * 25);
eq("Crossing standard all day (rate sheet)", quoteRoom(DEFAULT_PRICES.crossing, false, 14).amount, 800 + 10 * 75);
eq("Loft non-profit 6 hrs", quoteRoom(DEFAULT_PRICES.loft, true, 6).amount, 275 + 2 * 50);
eq("unknown room is 0", quoteRoom(undefined, false, 6).amount, 0);
eq("CrossPointe A 4 hrs std", quoteRoom(DEFAULT_PRICES["crosspointe-a"], false, 4).amount, 200);
eq("day total, 2 rooms afternoon", dayTotal({ timeSlot: "afternoon", rooms: [{ roomId: "crosspointe-a" }, { roomId: "crosspointe-b" }] }, DEFAULT_PRICES, false), 450);
eq("day total ignores duplicate rooms", dayTotal({ timeSlot: "morning", rooms: [{ roomId: "crosspointe-a" }, { roomId: "crosspointe-a" }] }, DEFAULT_PRICES, false), 200);
if (fail) { console.error(`${fail} pricing test(s) failed`); process.exit(1); }
console.log("All pricing tests passed");
