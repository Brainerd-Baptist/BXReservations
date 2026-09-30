"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { useToast } from "./Toast";
import LoadError from "./load-error";

type Person = {
  id: string; invited_email: string; collab_role: "co_owner" | "viewer"; accepted_at: string | null;
  created_at: string; invite_sent_at: string | null; invite_error: string | null;
};
type Resp = { people: Person[]; canManage: boolean; organizerEmail: string | null };

const ROLE_LABEL = { co_owner: "Co-organizer", viewer: "Viewer" } as const;
const ROLE_HINT = {
  co_owner: "Can view, edit, message the BX team, cancel, and gets every notification.",
  viewer: "Can see the booking details and gets the confirmation emails.",
};

async function jsonOrThrow(res: Response) {
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as { error?: string }).error ?? `Error ${res.status}`);
  return d;
}

/**
 * People on a booking — invite co-organizers and viewers at any time,
 * change roles, resend or remove. Shows whether each email actually went out.
 */
export default function PeopleCard({ reservationId }: { reservationId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"co_owner" | "viewer">("viewer");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await jsonOrThrow(await fetch(`/api/reservations/${reservationId}/people`))); }
    catch (e) { setError((e as Error).message); }
  }, [reservationId]);
  useEffect(() => {
    let live = true;
    fetch(`/api/reservations/${reservationId}/people`).then(jsonOrThrow)
      .then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [reservationId]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast(ok, "success"); await load(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(null); }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { toast("Enter a valid email.", "error"); return; }
    await run("invite", async () => {
      const d = await jsonOrThrow(await fetch("/api/collaborators/invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId, email: addr, role }),
      }));
      setEmail("");
      if (!(d as { emailed?: boolean }).emailed) throw new Error("Added, but the email didn't send — use Resend.");
    }, `Invited ${addr}.`);
  }

  if (error) return <LoadError what="people" message={error} onRetry={load} />;
  if (!data) return <p className="text-sm text-slate" aria-busy="true">Loading…</p>;

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {data.organizerEmail && (
          <li className="bx-well rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm text-parchment truncate">{data.organizerEmail}</span>
              <span className="block text-xs text-slate">Organizer</span>
            </span>
          </li>
        )}
        {data.people.map((p) => {
          const status = p.accepted_at ? "Joined"
            : p.invite_error ? "Email didn't send"
            : p.invite_sent_at ? "Invited — waiting to accept"
            : "Invited";
          return (
            <li key={p.id} className="bx-well rounded-xl px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm text-parchment break-all">{p.invited_email}</span>
                  <span className="block text-xs" style={{ color: p.invite_error ? "var(--bx-clay)" : "var(--bx-slate)" }}>
                    {ROLE_LABEL[p.collab_role]} · {status}
                  </span>
                </span>
                {data.canManage && (
                  <div className="flex flex-wrap gap-1.5">
                    <select aria-label={`Role for ${p.invited_email}`} className="bx-input bx-input--sm w-auto" value={p.collab_role}
                      disabled={busy === `r-${p.id}`}
                      onChange={(e) => run(`r-${p.id}`, async () => jsonOrThrow(await fetch(`/api/collaborators/${p.id}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: e.target.value }),
                      })), "Role updated.")}>
                      <option value="co_owner">Co-organizer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    {!p.accepted_at && (
                      <Button size="sm" variant="secondary" loading={busy === `s-${p.id}`}
                        onClick={() => run(`s-${p.id}`, async () => jsonOrThrow(await fetch(`/api/collaborators/${p.id}`, { method: "POST" })), "Invitation sent again.")}>
                        Resend
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label={`Remove ${p.invited_email}`} loading={busy === `d-${p.id}`}
                      onClick={() => { if (confirm(`Remove ${p.invited_email} from this booking?`)) run(`d-${p.id}`, async () => jsonOrThrow(await fetch(`/api/collaborators/${p.id}`, { method: "DELETE" })), "Removed."); }}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
              {p.invite_error && (
                <p className="text-xs text-slate">
                  Some providers (often iCloud) hold or reject mail from new senders. Ask them to check spam, or resend.
                </p>
              )}
            </li>
          );
        })}
        {data.people.length === 0 && <li className="text-sm text-slate">No one else yet.</li>}
      </ul>

      {data.canManage && (
        <form onSubmit={invite} className="bx-well rounded-xl p-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Invite by email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required autoComplete="email" />
          </Field>
          <Field label="Access" hint={ROLE_HINT[role]}>
            <Select value={role} onChange={(e) => setRole(e.target.value as "co_owner" | "viewer")}>
              <option value="viewer">Viewer</option>
              <option value="co_owner">Co-organizer</option>
            </Select>
          </Field>
          <Button type="submit" size="md" loading={busy === "invite"} className="sm:mb-[1.4rem]">Send invite</Button>
        </form>
      )}
    </div>
  );
}
