"use client";
import { useSyncExternalStore } from "react";

// Single Frosted Glass UI kit. Palette/blur tokens live in app/globals.css under [data-theme="frost"]
// and the signature object lives in components/kit.tsx.
export const THEMES = [
  {
    id: "frost",
    name: "Frosted Glass",
    blurb: "Translucent glass cards, soft ambient blur, luminous edges",
    swatch: ["#E8EFF9", "#A5B4FC", "#86EFAC", "#FDA4AF"],
    noun: "glass card",
    shape: "square",
    deal: "Deal the cards",
    back: "Back to the lobby",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = "imposter:theme";
const DEFAULT: ThemeId = "frost";

const listeners = new Set<() => void>();
const current = (): ThemeId => DEFAULT;

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
  return [THEMES[0] ?? THEMES.find((t) => t.id === id)!, setTheme];
}

// Runs in <head> before paint so the single frosted glass theme is always applied.
export const themeBootScript = `try{document.documentElement.dataset.theme="frost";localStorage.setItem("${THEME_KEY}","frost")}catch(e){}`;
