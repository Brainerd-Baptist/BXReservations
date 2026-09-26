"use client";

// Event Map editor — the map in Event Mode for one reservation.
// The map page does all the editing UI; this component only relays each
// autosaved change to /api/event-map/[id] and reports back so the map can
// show Saved / Not saved.

import { useCallback } from "react";
import BxMapEmbed from "@/app/bx-map/bx-map-embed";
import type { EventLayer, EventMapChange } from "@/lib/event-map";

export default function EventMapEditor({ layer }: { layer: EventLayer }) {
  const onChange = useCallback(
    async (change: EventMapChange) => {
      if (layer.mode !== "edit") return;
      const res = await fetch(`/api/event-map/${layer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: [change] }),
      });
      if (!res.ok) {
        let msg = "Couldn't save";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
    },
    [layer.id, layer.mode]
  );

  return <BxMapEmbed event={layer} onChange={onChange} height="100%" />;
}
