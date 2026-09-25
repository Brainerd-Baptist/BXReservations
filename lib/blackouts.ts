// Shared blackout-checking utilities (client-safe, no Node APIs)

export interface BlackoutRule {
  id: string;
  rule_type: "dow" | "dow_slot" | "date";
  data: Record<string, unknown>;
  label: string;
  active: boolean;
}

export type TimeSlot = "any" | "morning" | "afternoon" | "evening";

/**
 * Returns true if the given date (YYYY-MM-DD) is entirely blacked out.
 */
export function isDateBlackedOut(dateStr: string, rules: BlackoutRule[]): boolean {
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return rules.some(r => {
    if (!r.active) return false;
    if (r.rule_type === "dow" && r.data.dow === dow) return true;
    if (r.rule_type === "date" && r.data.date === dateStr) return true;
    return false;
  });
}

/**
 * Returns true if the given slot is blacked out on this date.
 * Full-day blackouts also block all slots.
 */
export function isSlotBlackedOut(
  dateStr: string,
  slot: TimeSlot,
  rules: BlackoutRule[]
): boolean {
  if (isDateBlackedOut(dateStr, rules)) return true;
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return rules.some(r => {
    if (!r.active) return false;
    if (r.rule_type === "dow_slot" && r.data.dow === dow && r.data.slot === slot) return true;
    return false;
  });
}

/**
 * Returns a human-readable reason why a date/slot is blacked out, or null.
 */
export function blackoutReason(
  dateStr: string,
  slot: TimeSlot | null,
  rules: BlackoutRule[]
): string | null {
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  for (const r of rules) {
    if (!r.active) continue;
    if (r.rule_type === "dow" && r.data.dow === dow) return r.label;
    if (r.rule_type === "date" && r.data.date === dateStr) return r.label;
    if (slot && r.rule_type === "dow_slot" && r.data.dow === dow && r.data.slot === slot)
      return r.label;
  }
  return null;
}

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_LABELS: Record<string, string> = {
  morning: "Morning (8a–12p)",
  afternoon: "Afternoon (12p–5p)",
  evening: "Evening (5p–10p)",
};

export function ruleDescription(rule: BlackoutRule): string {
  if (rule.rule_type === "dow") {
    return `Every ${DOW_NAMES[rule.data.dow as number]} (all day)`;
  }
  if (rule.rule_type === "dow_slot") {
    return `Every ${DOW_NAMES[rule.data.dow as number]} — ${SLOT_LABELS[rule.data.slot as string] ?? rule.data.slot}`;
  }
  if (rule.rule_type === "date") {
    return `${rule.data.date as string}${rule.label ? ` (${rule.label})` : ""}`;
  }
  return JSON.stringify(rule.data);
}
