// Sign-in return-path safety (lib/return-path.ts). Run: node --experimental-strip-types scripts/test-return-path.mts
import { safeNext, loginHref } from "../lib/return-path.ts";
let failed = 0;
const ok = (name: string, got: unknown, want: unknown) => { const pass = JSON.stringify(got) === JSON.stringify(want); if (!pass) failed++; console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(got)); };
ok("same-site path kept", safeNext("/reservations/abc"), "/reservations/abc");
ok("query kept", safeNext("/account/invites?token=a%20b"), "/account/invites?token=a%20b");
ok("protocol-relative blocked", safeNext("//evil.com"), null);
ok("absolute URL blocked", safeNext("https://evil.com"), null);
ok("backslash trick blocked", safeNext("/\\evil.com"), null);
ok("javascript: blocked", safeNext("javascript:alert(1)"), null);
ok("no loop into login", safeNext("/login?next=/x"), null);
ok("no loop into callback", safeNext("/auth/callback"), null);
ok("encoded path accepted", safeNext("%2Freserve"), "/reserve");
ok("loginHref encodes", loginHref("/reservations/1"), "/login?next=%2Freservations%2F1");
ok("loginHref home = plain", loginHref("/"), "/login");
if (failed) { console.error(`${failed} return-path test(s) failed`); process.exit(1); }
