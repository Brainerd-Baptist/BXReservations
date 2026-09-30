// BX Building Map — /bx-map
// The map itself is generated outside this repo (see map-bundle.ts) and
// mounted by BxMapEmbed. Do not edit geometry, room data or map logic here.
// Signed-in visitors get a "Plan an event" link into their reservations.
// ?event=<share token> opens one reservation's event map read-only (no sign-in);
// the room in the hash (#l-crossing) is selected by the map itself.
import type { Metadata } from "next";
import { getUserAndRole } from "@/lib/get-user-role";
import { adminClient } from "@/lib/event-map";
import { resolveShareToken } from "@/lib/event-share";
import BxMapEmbed from "./bx-map-embed";
import { loginHref } from "@/lib/return-path";

export const metadata: Metadata = {
  title: "BX Building Map",
  description: "Interactive floor plan of the Brainerd Baptist BX building, lower and upper levels.",
};

export default async function BxMapPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event: token } = await searchParams;
  const shared = token ? await resolveShareToken(adminClient(), token) : null;
  const { user } = await getUserAndRole();
  const actions = user
    ? [{ label: "Plan an event on this map", href: "/bx-map/plan" }]
    : [{ label: "Sign in to plan an event", href: loginHref("/bx-map/plan") }];

  return (
    <div style={{ height: "calc(100dvh - var(--bx-header-h))", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {token && !shared && (
        <div
          role="status"
          style={{
            flex: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.8125rem",
            background: "color-mix(in srgb, #F59E0B 14%, var(--bx-ink))",
            color: "var(--bx-parchment)",
            borderBottom: "1px solid color-mix(in srgb, #F59E0B 30%, transparent)",
          }}
        >
          This event link is no longer active. Here is the building map instead.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <BxMapEmbed height="100%" actions={shared ? undefined : actions} event={shared?.layer ?? null} />
      </div>
    </div>
  );
}
