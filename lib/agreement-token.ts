import { randomBytes } from "crypto";

// Server-only: kept out of lib/agreements.ts so the public signing page doesn't
// ship Node's crypto library to the browser (C2: about 420 KB).
export function generateToken(): string {
  return randomBytes(24).toString("hex"); // 48-char hex, URL-safe
}
