"use client";
import { useState } from "react";
import NavSidebar from "./nav-sidebar";

export default function NavSidebarWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Hamburger button rendered in wrapper so it can toggle state */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed top-[11px] left-4 z-40 p-1.5 rounded-lg hover:bg-gray-100 transition-colors sm:left-4"
        style={{ display: open ? "none" : undefined }}
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <NavSidebar open={open} onClose={() => setOpen(false)} />
    </>
  );
}
