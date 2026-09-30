"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children directly under <body>.
 *
 * Overlays (lightboxes, modals, slide-overs) must escape their parents:
 * any ancestor with backdrop-filter, filter or transform becomes the
 * containing block for position:fixed, which would trap a "full-screen"
 * overlay inside a card. Portaling makes overlays immune to that.
 */
export default function BodyPortal({ children }: { children: ReactNode }) {
  // true on the client, false during SSR — without a setState-in-effect pass
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

const noopSubscribe = () => () => {};
