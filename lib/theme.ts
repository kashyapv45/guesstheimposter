"use client";
import { useSyncExternalStore } from "react";

// UI kits. Each has a palette/fonts block in app/globals.css under [data-theme="<id>"]
// and a signature object in components/kit.tsx (the home hero and the press-and-hold reveal).
export const THEMES = [
  { id: "crate", name: "1970s Crate Digger", blurb: "Kraft sleeves, cream paper, burnt-orange stamps", swatch: ["#f4efe6", "#d8c3a5", "#d95d39", "#e9b44c"], noun: "record", shape: "round", deal: "Drop the needle", back: "Back to the crate" },
  { id: "hifi", name: "Midnight Hi-Fi", blurb: "Brushed obsidian, amber tube glow, chrome tonearm", swatch: ["#111114", "#f59e0b", "#10b981", "#ef4444"], noun: "record", shape: "round", deal: "Drop the needle", back: "Back to the crate" },
  { id: "zine", name: "Neo-Brutalist Zine", blurb: "Thick ink borders, hard shadows, sticker badges", swatch: ["#fffdf5", "#111111", "#ffd23f", "#ff6b57"], noun: "sticker", shape: "square", deal: "Stamp it", back: "Back to the stack" },
  { id: "citypop", name: "80s Tokyo City Pop", blurb: "Pastel turquoise, sunset coral, glossy sheen", swatch: ["#fdf1e8", "#3cc6c0", "#ff7f6a", "#1f3a5f"], noun: "album", shape: "square", deal: "Press play", back: "Back to the shelf" },
  { id: "diner", name: "50s Diner Jukebox", blurb: "Cherry red, checkerboard, chrome, neon turquoise", swatch: ["#fdf6ec", "#c8102e", "#2ec4b6", "#9aa3a9"], noun: "45", shape: "round", deal: "Drop a nickel", back: "Back to the booth" },
  { id: "motown", name: "Motown Master Tape", blurb: "Reel-to-reel, walnut woodgrain, studio labels", swatch: ["#2a1a10", "#6b4426", "#d4a24c", "#f3e6cf"], noun: "tape", shape: "square", deal: "Roll tape", back: "Back to the studio" },
  { id: "mpc", name: "90s MPC & Wax", blurb: "Matte sampler pads, LCD green, stencil accents", swatch: ["#0e0f0d", "#7cff4f", "#ff5a36", "#e8e3d3"], noun: "pad", shape: "square", deal: "Drop the beat", back: "Back to the crates" },
  { id: "psych", name: "60s Acid Folk", blurb: "Marbled discs, tangerine, avocado and plum", swatch: ["#f6e7c8", "#f28c28", "#6b8e23", "#5b2a6e"], noun: "record", shape: "round", deal: "Drop the needle", back: "Back to the crate" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = "imposter:theme";
const DEFAULT: ThemeId = "hifi";
const ids = THEMES.map((t) => t.id) as string[];

const listeners = new Set<() => void>();
const current = (): ThemeId => {
  const t = document.documentElement.dataset.theme ?? "";
  return (ids.includes(t) ? t : DEFAULT) as ThemeId;
};

function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {}
  listeners.forEach((l) => l());
}

export function useTheme(): [Theme, (id: ThemeId) => void] {
  const id = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    current,
    () => DEFAULT,
  );
  return [THEMES.find((t) => t.id === id)!, setTheme];
}

// Runs in <head> before paint so a saved kit doesn't flash the default one. Unknown/old ids are ignored.
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(${JSON.stringify(ids)}.indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}`;
