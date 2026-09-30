"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Field, Input, Select } from "@/app/components/ui/field";
import { useToast } from "@/app/components/Toast";
import LoadError from "@/app/components/load-error";

type Org = { id: string; name: string };
type Tmpl = { id: string; name: string; description: string | null; org_id: string | null; org_name: string | null; summary: string };

async function jsonOrThrow(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `Error ${r.status}`);
  return d;
}

function useOrgs() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/organizations").then(jsonOrThrow)
      .then((d) => { if (live) setOrgs(((d as { organizations?: Org[] }).organizations ?? []).map(({ id, name }) => ({ id, name }))); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return orgs;
}

function AudienceSelect({ value, onChange, orgs, label = "Who can use it" }: { value: string; onChange: (v: string) => void; orgs: Org[]; label?: string }) {
  return (
    <Field label={label} hint={value ? "Only people linked to this organization see it on Reserve." : "Shown to everyone on the Reserve page."}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Everyone</option>
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
    </Field>
  );
}

/** Admin booking panel: turn this booking's setup into a reusable template. */
export function SaveTemplateButton({ reservationId, eventName, organizationId }: { reservationId: string; eventName: string; organizationId?: string | null }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const orgs = useOrgs();
  const [name, setName] = useState(eventName);
  const [description, setDescription] = useState("");
  const [orgId, setOrgId] = useState(organizationId ?? "");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Save as template</Button>;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await jsonOrThrow(await fetch("/api/admin/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, org_id: orgId || null, reservationId }),
      }));
      toast(`Template "${name}" saved — it now shows on the Reserve page.`, "success");
      setOpen(false);
    } catch (err) { toast((err as Error).message, "error"); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="bx-well rounded-xl p-4 space-y-3 w-full" aria-label="Save as template">
      <p className="text-xs text-slate">Copies this booking&apos;s spaces, setup, time, headcount and add-ons — not its dates, name or notes.</p>
      <Field label="Template name"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></Field>
      <Field label="Short description (optional)" hint="e.g. &quot;Banquet for 120 with the stage&quot;">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      </Field>
      <AudienceSelect value={orgId} onChange={setOrgId} orgs={orgs} />
      <div className="flex gap-2 justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" loading={busy}>Save template</Button>
      </div>
    </form>
  );
}

/** Settings: the list of templates — rename, change who sees it, remove. */
export default function TemplatesManager() {
  const { toast } = useToast();
  const orgs = useOrgs();
  const [list, setList] = useState<Tmpl[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; description: string; org: string }>({ name: "", description: "", org: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setList(await jsonOrThrow(await fetch("/api/admin/templates"))); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { queueMicrotask(load); }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast(ok, "success"); setEditing(null); await load(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(null); }
  }

  return (
    <section className="bx-glass rounded-xl p-5 space-y-4" aria-labelledby="tmpl-admin-h">
      <div>
        <h2 id="tmpl-admin-h" className="text-sm font-semibold text-parchment">Booking templates</h2>
        <p className="text-xs text-slate">Repeat renters start from these on the Reserve page. To add one, open a booking in Requests and choose <span className="text-parchment">Save as template</span>.</p>
      </div>
      {error && <LoadError what="templates" message={error} onRetry={load} />}
      {!error && !list && <p className="text-sm text-slate" aria-busy="true">Loading…</p>}
      {list && list.length === 0 && <p className="text-sm text-slate">No templates yet.</p>}
      {list && list.length > 0 && (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={t.id} className="bx-well rounded-xl px-4 py-3">
              {editing === t.id ? (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(`s-${t.id}`, async () => jsonOrThrow(await fetch(`/api/admin/templates/${t.id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: draft.name, description: draft.description, org_id: draft.org || null }),
                })), "Template updated."); }}>
                  <Field label="Name"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={80} /></Field>
                  <Field label="Description"><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} /></Field>
                  <AudienceSelect value={draft.org} onChange={(v) => setDraft({ ...draft, org: v })} orgs={orgs} />
                  <div className="flex gap-2 justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button type="submit" size="sm" loading={busy === `s-${t.id}`}>Save</Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-parchment break-words">{t.name}</p>
                    <p className="text-xs text-slate break-words">{t.summary}</p>
                    <p className="text-xs text-slate">{t.org_name ? `Only ${t.org_name}` : "Everyone"}{t.description ? ` · ${t.description}` : ""}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => { setEditing(t.id); setDraft({ name: t.name, description: t.description ?? "", org: t.org_id ?? "" }); }}>Edit</Button>
                    <Button size="sm" variant="ghost" loading={busy === `d-${t.id}`}
                      onClick={() => { if (confirm(`Remove the template "${t.name}"? Past bookings aren't affected.`)) run(`d-${t.id}`, async () => jsonOrThrow(await fetch(`/api/admin/templates/${t.id}`, { method: "DELETE" })), "Template removed."); }}>
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
