// BX Building Map — /bx-map
// The map itself is generated outside this repo (see map-bundle.ts) and
// mounted by BxMapEmbed. Do not edit geometry, room data or map logic here.
// Signed-in visitors get a "Plan an event" link into their reservations.
import type { Metadata } from "next";
import { getUserAndRole } from "@/lib/get-user-role";
import BxMapEmbed from "./bx-map-embed";

export const metadata: Metadata = {
  title: "BX Building Map",
  description: "Interactive floor plan of the Brainerd Baptist BX building, lower and upper levels.",
};

export default async function BxMapPage() {
  const { user } = await getUserAndRole();
  const actions = user
    ? [{ label: "Plan an event on this map", href: "/bx-map/plan" }]
    : [{ label: "Sign in to plan an event", href: "/login" }];

  return (
    <div style={{ height: "calc(100dvh - 56px)", overflow: "hidden" }}>
      <BxMapEmbed height="100%" actions={actions} />
    </div>
  );
}
