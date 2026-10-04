import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fundamentals",
    short_name: "Fundamentals",
    description: "A few minutes a day to keep your fundamentals sharp.",
    start_url: "/today",
    display: "standalone",
    background_color: "#FAFBFC",
    theme_color: "#2F4FD0",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
