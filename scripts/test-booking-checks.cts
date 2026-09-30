// Server-side booking checks (C2) — mirrors the booking form's rules.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- run by tsx as CommonJS
const { checkDays } = require("../lib/booking-checks");

const rules = [
  { id: "1", rule_type: "dow", data: { dow: 0 }, label: "Sundays", active: true },
  { id: "2", rule_type: "dow_slot", data: { dow: 3, slot: "evening" }, label: "Wednesday nights", active: true },
  { id: "3", rule_type: "date", data: { date: "2031-12-25" }, label: "Christmas", active: true },
] as never[];
const day = (date: string, extra: object = {}) => ({ date, included: true, timeSlot: "any", rooms: [{ roomId: "crossing" }], ...extra });
let fail = 0;
const t = (name: string, got: unknown, want: unknown) => {
  const ok = want === null ? got === null : typeof got === "string" && got.includes(String(want));
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} -> ${got}`);
};
t("normal weekday booking", checkDays([day("2031-06-03")], rules), null);       // Tuesday
t("all day on a Wednesday (part-day rule only)", checkDays([day("2031-06-04")], rules), null);
t("Wednesday evening blocked", checkDays([day("2031-06-04", { timeSlot: "evening" })], rules), "Wednesday nights");
t("Sunday blocked", checkDays([day("2031-06-01")], rules), "Sundays");
t("Christmas blocked", checkDays([day("2031-12-25")], rules), "Christmas");
t("past date", checkDays([day("2020-01-07")], rules), "already passed");
t("unknown room", checkDays([day("2031-06-03", { rooms: [{ roomId: "nope" }] })], rules), "isn't available to book");
t("no rooms at all", checkDays([day("2031-06-03", { rooms: [] })], rules), "at least one day");
t("one day without rooms is fine", checkDays([day("2031-06-03"), day("2031-06-05", { rooms: [] })], rules), null);
t("excluded Sunday ignored", checkDays([day("2031-06-03"), day("2031-06-01", { included: false })], rules), null);
if (fail) { console.error(`${fail} failed`); process.exit(1); }
