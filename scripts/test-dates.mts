// Venue-date rules (lib/dates.ts). Run: TZ=America/New_York node --experimental-strip-types scripts/test-dates.mts
import { venueToday, formatYmd, daysFromToday, isUpcoming, includedDates, toVenueYmd } from "../lib/dates.ts";
const at = (iso: string) => new Date(iso);
let failed = 0;
const ok = (name: string, got: unknown, want: unknown) => { const pass = JSON.stringify(got) === JSON.stringify(want); if (!pass) failed++; console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(got)); };
ok("Oct 21 displays as Oct 21", formatYmd("2026-10-21"), "Oct 21, 2026");
ok("venue today at 11pm ET = same day", venueToday(at("2026-10-22T03:30:00Z")), "2026-10-21");
ok("event today still upcoming at 9pm ET", isUpcoming("confirmed", { days: [{ date: "2026-10-21" }] }, at("2026-10-22T01:00:00Z")), true);
ok("event yesterday is past", isUpcoming("confirmed", { days: [{ date: "2026-10-20" }] }, at("2026-10-21T14:00:00Z")), false);
ok("multi-day stays upcoming mid-event", isUpcoming("approved", { days: [{ date: "2026-10-20" }, { date: "2026-10-22" }] }, at("2026-10-21T14:00:00Z")), true);
ok("excluded last day ignored", isUpcoming("approved", { days: [{ date: "2026-10-20" }, { date: "2026-10-25", included: false }] }, at("2026-10-21T14:00:00Z")), false);
ok("cancelled_by_user is closed", isUpcoming("cancelled_by_user", { days: [{ date: "2030-01-01" }] }), false);
ok("COI expiring today = 0 days", daysFromToday(toVenueYmd("2026-10-21"), at("2026-10-22T00:30:00Z")), 0);
ok("included dates sorted", includedDates({ days: [{ date: "2026-10-22" }, { date: "2026-10-20" }, { date: "2026-10-21", included: false }] }), ["2026-10-20", "2026-10-22"]);
if (failed) { console.error(`${failed} date test(s) failed`); process.exit(1); }
