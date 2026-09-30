// "Your next steps" at the top of a booking (C3): what's done, what's waiting
// on you, and what isn't needed. Server component — no client code.
type Step = { label: string; state: "done" | "todo" | "waiting" | "optional"; note?: string; href?: string };

const ICON: Record<Step["state"], string> = { done: "✓", todo: "!", waiting: "…", optional: "○" };
const TONE: Record<Step["state"], string> = {
  done: "var(--tone-green-fg)", todo: "var(--tone-orange-fg)", waiting: "var(--bx-slate)", optional: "var(--bx-slate)",
};

export default function BookingChecklist({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  const left = steps.filter((s) => s.state === "todo").length;
  return (
    <section aria-labelledby="steps-h" className="bx-glass rounded-xl" style={{ padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
      <h2 id="steps-h" style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bx-slate)" }}>
        Your next steps{left ? ` · ${left} waiting on you` : ""}
      </h2>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
        {steps.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <span aria-hidden="true" style={{ flex: "none", width: 22, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: TONE[s.state], border: `1.5px solid ${TONE[s.state]}` }}>
              {ICON[s.state]}
            </span>
            <span style={{ minWidth: 0, fontSize: "0.875rem", lineHeight: 1.45 }}>
              <span className="sr-only">{s.state === "done" ? "Done: " : s.state === "todo" ? "To do: " : s.state === "optional" ? "Optional: " : "Waiting: "}</span>
              {s.href ? <a href={s.href} style={{ color: "var(--bx-parchment)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>{s.label}</a>
                : <span style={{ color: s.state === "done" ? "var(--bx-slate)" : "var(--bx-parchment)", fontWeight: s.state === "todo" ? 600 : 500 }}>{s.label}</span>}
              {s.note && <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--bx-slate)" }}>{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export type { Step as ChecklistStep };
