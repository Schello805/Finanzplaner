import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanzplaner",
    short_name: "Finanzplaner",
    description: "Private Ausgabenanalyse für Familien",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f8",
    theme_color: "#087e82",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
