// Smoke test — loads the public pages in a real browser and fails on any
// crash, error page, or missing landmark. Also guards known regressions.
//
//   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
//
// Needs `playwright` (CI installs it with --no-save; locally: npm i --no-save playwright).
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = [
  { path: "/", expect: "BX Reservations" },
  { path: "/rooms", expect: "The Crossing" },
  { path: "/login", expect: "Sign in" },
  { path: "/reserve", expect: "get started" },
];

const failures = [];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

for (const theme of ["brainerd", "glass-dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((t) => localStorage.setItem("bx-reservations-theme", t), theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  for (const { path, expect } of PAGES) {
    errors.length = 0;
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" }).catch((e) => ({ status: () => 0, err: e }));
    const status = res?.status?.() ?? 0;
    const text = await page.locator("body").innerText().catch(() => "");
    const tag = `[${theme}] ${path}`;
    if (status >= 400 || status === 0) failures.push(`${tag}: HTTP ${status}`);
    if (/This page couldn.t load|Application error/i.test(text)) failures.push(`${tag}: error page shown`);
    if (!text.toLowerCase().includes(expect.toLowerCase())) failures.push(`${tag}: missing "${expect}"`);
    if (errors.length) failures.push(`${tag}: page errors: ${errors.join(" | ")}`);
    const ambient = await page.locator(".bx-ambient").count();
    if (!ambient) failures.push(`${tag}: ambient background missing`);
    console.log(`${failures.length ? "…" : "ok"} ${tag}`);
  }
  await ctx.close();
}

// Regression guard: the public Planning Center debug endpoint must stay gone.
{
  const ctx = await browser.newContext();
  const res = await ctx.request.get(BASE + "/api/debug/pco-live-test");
  if (res.status() !== 404) failures.push(`/api/debug/pco-live-test should be 404, got ${res.status()}`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error("\nSmoke test failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("\nSmoke test passed.");
