"use client";
import { useEffect } from "react";

/**
 * Attaches an IntersectionObserver to every .bx-fade-in element.
 * A MutationObserver watches for new elements added after initial render
 * (e.g. client components that hydrate late) and observes those too.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const seen = new WeakSet<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("bx-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    function observe(root: Document | Element = document) {
      root.querySelectorAll<HTMLElement>(".bx-fade-in").forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          io.observe(el);
        }
      });
    }

    // Observe elements already in the DOM
    observe();

    // Watch for elements added later (client-component hydration)
    const mo = new MutationObserver(() => observe());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
