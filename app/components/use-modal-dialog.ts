"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Makes an overlay behave like a real modal dialog (W3C APG dialog pattern):
 *
 *  - focus moves into the dialog when it opens (an element marked
 *    `data-autofocus`, else the first focusable, else the panel itself)
 *  - Tab / Shift+Tab stay inside the dialog
 *  - Escape closes it
 *  - everything outside it is `inert` — unreachable by keyboard, mouse and
 *    screen readers — and the page behind stops scrolling
 *  - focus returns to whatever opened it when it closes
 *
 * Render the dialog in a <BodyPortal> so "everything outside" is exactly the
 * rest of the page. A separate backdrop element portaled next to the panel
 * needs `data-modal-part` so it stays clickable (click-outside-to-close). Put role="dialog", aria-modal="true" and an aria-label or
 * aria-labelledby on the panel. (Audit F02.)
 */
const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

let openCount = 0; // nested dialogs: only the outermost unlocks scroll

export function useModalDialog(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const opener = document.activeElement as HTMLElement | null;

    // Inert every top-level page region that doesn't contain this dialog.
    const host = Array.from(document.body.children).find((c) => c.contains(panel));
    const madeInert = Array.from(document.body.children).filter(
      (c) =>
        c !== host &&
        !c.hasAttribute("inert") &&
        !c.hasAttribute("data-modal-part") && // this dialog's own backdrop must stay clickable
        !["SCRIPT", "STYLE", "LINK"].includes(c.tagName)
    );
    madeInert.forEach((el) => el.setAttribute("inert", ""));

    openCount += 1;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
    const first = panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0];
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    (first ?? panel).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel || !panel.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !panel.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      madeInert.forEach((el) => el.removeAttribute("inert"));
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = prevOverflow;
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, panelRef]);
}
