import type { MetadataRoute } from "next";

// Home-screen / tab icons and name (Safari, Chrome, Android)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BX Reservations — Brainerd Baptist",
    short_name: "BX Reservations",
    description: "Reserve space at the BX Community Center.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1020",
    theme_color: "#00205b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
