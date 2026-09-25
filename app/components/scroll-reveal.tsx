"use client";
import { useEffect } from "react";

/**
 * Attaches an IntersectionObserver to every .bx-fade-in element on the page.
 * When an element scrolls into view it gets the .bx-visible class, triggering
 * the CSS transition defined in globals.css.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".bx-fade-in");
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("bx-visible");
            observer.unobserve(entry.target); // fire once
          }
        });
      },
      { threshold: 0.12 }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
