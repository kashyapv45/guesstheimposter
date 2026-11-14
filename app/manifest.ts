import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Guess the Imposter",
    short_name: "Imposter",
    description: "Retro vinyl party game: find the imposter.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4EFE6",
    theme_color: "#F4EFE6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
