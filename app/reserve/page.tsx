import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient } from "@/lib/event-map";
import { getTemplateFor, listTemplatesFor, patternForRebook } from "@/lib/templates";
import type { BookingPattern } from "@/lib/booking-pattern";
import ReserveClient from "./reserve-client";
import { can } from "@/lib/roles";

export interface StartingPoint {
  kind: "rebook" | "template";
  label: string;         // "Book again: Fall Retreat" / template name
  pattern: BookingPattern;
}
export interface TemplateOption { id: string; name: string; description: string | null; orgName: string | null; summary: string }

type Props = { searchParams: Promise<{ from?: string; template?: string }> };

export default async function ReservePage({ searchParams }: Props) {
  const { user, profile, role } = await getUserAndRole();
  const sp = await searchParams;

  const initialContact = user
    ? {
        name: profile?.display_name ?? "",
        email: user.email,
        phone: profile?.phone ?? "",
        org: profile?.organization ?? "",
      }
    : undefined;

  // "Book again" (?from=<booking>) or a staff template (?template=<id>).
  // Loaded here so the form opens already filled in; both check access.
  let start: StartingPoint | null = null;
  let templates: TemplateOption[] = [];
  try {
    const db = adminClient();
    const [rebook, tmpl, list] = await Promise.all([
      sp.from && user ? patternForRebook(db, user, sp.from) : Promise.resolve(null),
      sp.template ? getTemplateFor(db, sp.template, user?.id ?? null) : Promise.resolve(null),
      listTemplatesFor(db, user?.id ?? null),
    ]);
    if (rebook) start = { kind: "rebook", label: rebook.eventName ? `Book again: ${rebook.eventName}` : "Book again", pattern: rebook.pattern };
    else if (tmpl) start = { kind: "template", label: tmpl.name, pattern: tmpl.pattern };
    templates = list.map(({ id, name, description, orgName, summary }) => ({ id, name, description, orgName, summary }));
  } catch (e) {
    console.error("[reserve] starting point failed:", (e as Error).message);
  }

  return (
    <ReserveClient
      // A new starting point remounts the form so it fills in from scratch
      key={start ? `${start.kind}:${sp.from ?? sp.template}` : "blank"}
      initialContact={initialContact}
      userId={user?.id ?? null}
      start={start}
      templates={templates}
      churchUse={can.churchUse(role)}
    />
  );
}
