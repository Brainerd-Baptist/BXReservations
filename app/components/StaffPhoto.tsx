"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface StaffPhotoProps {
  thumbSrc: string;
  fullSrc: string;
  name: string;
  size?: number;
}

export default function StaffPhoto({ thumbSrc, fullSrc, name, size = 80 }: StaffPhotoProps) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Circular thumbnail — click to expand */}
      <button
        onClick={() => setOpen(true)}
        className="group relative rounded-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00abc9] focus-visible:ring-offset-2"
        style={{ width: size, height: size }}
        aria-label={`View ${name}'s photo`}
      >
        <Image
          src={thumbSrc}
          alt={name}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          style={{ width: size, height: size }}
        />
        {/* Hover overlay */}
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white opacity-0 group-hover:opacity-90 transition-opacity drop-shadow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-2.5 3.5L17 17" />
          </svg>
        </span>
      </button>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360, width: "100%" }}
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white shadow transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Full portrait */}
            <Image
              src={fullSrc}
              alt={name}
              width={360}
              height={540}
              className="object-cover w-full"
              style={{ display: "block" }}
            />

            {/* Name strip */}
            <div className="px-5 py-4 text-center">
              <div className="font-bold text-gray-900">{name}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
