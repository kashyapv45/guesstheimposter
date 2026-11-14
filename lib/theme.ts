"use client";
import { useSyncExternalStore } from "react";

// UI kits: each is a palette in app/globals.css under [data-theme="<id>"]. Add one there and here.
export const THEMES = [
  { id: "hifi", name: "Midnight Hi-Fi", blurb: "Brushed obsidian, amber tube glow", swatch: ["#121214", "#f59e0b", "#10b981", "#ef4444"] },
  { id: "retro", name: "Retro Vinyl", blurb: "Cream sleeve, kraft card, burnt orange", swatch: ["#f4efe6", "#d8c3a5", "#d95d39", "#2a9d8f"] },
  { id: "neon", name: "Neon Arcade", blurb: "Midnight purple, cyan and magenta glow", swatch: ["#0d0221", "#00e5ff", "#39ff14", "#ff2d95"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_KEY = "imposter:theme";

const listeners = new Set<() => void>();
const current = () => (document.documentElement.dataset.theme as ThemeId | undefined) ?? "hifi";

function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {}
  listeners.forEach((l) => l());
}

export function useTheme(): [ThemeId, (id: ThemeId) => void] {
  const theme = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    current,
    () => "hifi" as ThemeId,
  );
  return [theme, setTheme];
}

// Runs in <head> before paint so a saved kit doesn't flash the default one.
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t)document.documentElement.dataset.theme=t}catch(e){}`;
