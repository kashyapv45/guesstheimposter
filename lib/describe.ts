"use client";
// What the secret word is, for crew only (never the imposter): a short, specific explanation.
// Hand-written notes in data/categories/*.json win; otherwise the first two sentences of the Wikipedia
// summary, steered by the category so "Frozen" finds the film and "Mercury" the planet.
// Cached per device; gives up after a short timeout.
import { noteFor, type WordEntry } from "./words";

const HINT: Record<string, string> = {
  "everyday-objects": "object",
  "foods-drinks": "food",
  animals: "animal",
  "countries-landmarks": "",
  "jobs-professions": "occupation",
  "movies-tv": "film television",
  "music-instruments": "music",
  "sports-games": "game sport",
  "brands-tech": "brand",
  "nature-space": "",
  "historical-figures": "",
  "fictional-characters": "fictional character",
  "vehicles-transport": "vehicle",
  "hobbies-activities": "hobby",
  "places-buildings": "",
};
const CACHE = "imposter:about:";
const MAX = 280;

// First two sentences of the summary: specific enough to explain an unfamiliar word.
function lead(text: string | undefined) {
  if (!text) return null;
  const two = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return two.length > MAX ? two.slice(0, MAX - 1).trimEnd() + "…" : two;
}

export async function describe(w: WordEntry, timeoutMs = 3000): Promise<string | null> {
  const note = noteFor(w);
  if (note) return note;
  const key = CACHE + w.id;
  try {
    const hit = localStorage.getItem(key);
    if (hit !== null) return hit || null;
  } catch {}
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const summary = async (title: string) => {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: ctrl.signal });
    const sum = r.ok ? await r.json() : null;
    return sum?.type === "standard" ? (lead(sum.extract) ?? sum.description ?? null) : null;
  };
  try {
    // 1) The word's own article ("Theremin" the instrument, not its inventor).
    let text: string | null = await summary(w.word);
    // 2) Missing or ambiguous ("Frozen"): search with the category, preferring "Frozen (2013 film)"-style titles.
    if (!text) {
      const q = encodeURIComponent(`${w.word} ${HINT[w.category] ?? ""}`.trim());
      const search = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=5&format=json&origin=*`, { signal: ctrl.signal })).json();
      const titles: string[] = (search?.query?.search ?? []).map((r: { title: string }) => r.title);
      const lw = w.word.toLowerCase();
      const best = titles.find((t) => t.toLowerCase().startsWith(`${lw} (`)) ?? titles.find((t) => t.toLowerCase() === lw) ?? titles[0];
      if (best) text = await summary(best);
    }
    try {
      localStorage.setItem(key, text ?? "");
    } catch {}
    return text;
  } catch {
    return null; // offline or slow: the word just shows without an explanation
  } finally {
    clearTimeout(timer);
  }
}
