import type { MetadataRoute } from "next";

// "Add to home screen": the app opens full screen with its own icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "errandJaeger",
    short_name: "errandJaeger",
    description: "Turn Boston errands into a calmer bingo walk.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf6ee",
    theme_color: "#1f5f5b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
