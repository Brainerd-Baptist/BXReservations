"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";

export interface QuoteMessage { id: string; author_name: string | null; author_role: string; body: string; created_at: string }

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Questions about the quote — the same Messages thread as the booking page,
 * so the whole conversation stays in one place.
 */
export default function QuoteConversation({ token, messages, bookingId, canPost }: {
  token: string; messages: QuoteMessage[]; bookingId: string; canPost: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/quote/${token}/message`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Couldn't send — try again.");
      setText(""); setSent(true);
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="bx-glass rounded-2xl p-5 space-y-4" aria-labelledby="q-msgs">
      <div>
        <h2 id="q-msgs" className="text-lg font-bold text-parchment">Questions?</h2>
        <p className="text-sm text-slate">
          Ask the BX team anything about this quote. It goes into your booking&apos;s messages — replies show up here, by email, and on your{" "}
          <a className="underline" href={`/reservations/${bookingId}`}>booking page</a>.
        </p>
      </div>
      {messages.length > 0 && (
        <ol className="space-y-2 max-h-80 overflow-y-auto" aria-label="Messages">
          {messages.map((m) => {
            const staff = m.author_role === "admin";
            return (
              <li key={m.id} className={`rounded-xl px-3.5 py-2.5 text-sm ${staff ? "bx-tone-indigo border" : "bx-well"}`}>
                <p className="text-xs text-slate mb-0.5">
                  <strong className="text-parchment">{staff ? `${m.author_name || "BX team"} · BX team` : m.author_name || "You"}</strong> · {when(m.created_at)}
                </p>
                <p className="whitespace-pre-line text-parchment">{m.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      {canPost ? (
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="q-msg" className="sr-only">Your question</label>
          <textarea id="q-msg" className="bx-input w-full" rows={3} maxLength={4000} value={text}
            onChange={(e) => { setText(e.target.value); setSent(false); }} placeholder="e.g. Can we come in an hour early to set up?" />
          {error && <p className="bx-tone-red border rounded-lg px-3 py-2 text-sm" role="alert">{error}</p>}
          {sent && <p className="text-xs" style={{ color: "var(--tone-green-fg)" }} role="status">Sent — the BX team will reply soon.</p>}
          <Button type="submit" variant="secondary" loading={busy} disabled={text.trim().length < 2}>Send question</Button>
        </form>
      ) : (
        <p className="text-xs text-slate">Staff preview — reply from the booking in Admin.</p>
      )}
    </section>
  );
}
