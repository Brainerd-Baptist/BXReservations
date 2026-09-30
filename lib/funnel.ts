// Booking funnel events (Phase 6). Shared by the browser tracker and the API.
export const FUNNEL_EVENTS = ["reserve_view", "step_reached", "submit_attempt", "submit_ok", "submit_fail"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

let memoryId: string | null = null;

/** A random id for this browser tab — groups one visit's events. No personal data. */
function sessionId(): string {
  const make = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    let id = sessionStorage.getItem("bx-funnel-id");
    if (!id) { id = make(); sessionStorage.setItem("bx-funnel-id", id); }
    return id;
  } catch {
    return (memoryId ??= make());
  }
}

/** Fire-and-forget: never throws, never blocks the booking. */
export function trackFunnel(event: FunnelEvent, opts: { step?: number; detail?: string } = {}): void {
  try {
    const body = JSON.stringify({ session_id: sessionId(), event, step: opts.step ?? null, detail: opts.detail?.slice(0, 120) ?? null });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      if (navigator.sendBeacon("/api/funnel", new Blob([body], { type: "application/json" }))) return;
    }
    void fetch("/api/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* measuring must never break booking */ }
}
