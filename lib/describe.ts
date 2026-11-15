"use client";
// One-line description of the secret word, shown to crew only (never the imposter).
// Hand-written notes in data/categories/*.json win; otherwise Wikipedia, steered by the category
// so "Frozen" finds the film and "Mercury" the planet. Cached per device; gives up after a short timeout.
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
const CACHE = "imposter:desc:";
const MAX = 140;

function firstSentence(text: string | undefined) {
  if (!text) return null;
  const s = text.split(/(?<=\.)\s/)[0];
  return s.length > MAX ? s.slice(0, MAX - 1).trimEnd() + "…" : s;
}

export async function describe(w: WordEntry, timeoutMs = 2500): Promise<string | null> {
  const note = noteFor(w);
  if (note) return note;
  const key = CACHE + w.id;
  try {
    const hit = localStorage.getItem(key);
    if (hit !== null) return hit || null;
  } catch {}
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const q = encodeURIComponent(`${w.word} ${HINT[w.category] ?? ""}`.trim());
    const search = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=1&format=json&origin=*`, { signal: ctrl.signal })).json();
    const title: string | undefined = search?.query?.search?.[0]?.title;
    let desc: string | null = null;
    if (title) {
      const sum = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: ctrl.signal })).json();
      if (sum?.type !== "disambiguation") desc = sum?.description ? sum.description[0].toUpperCase() + sum.description.slice(1) : firstSentence(sum?.extract);
    }
    try {
      localStorage.setItem(key, desc ?? "");
    } catch {}
    return desc;
  } catch {
    return null; // offline or slow: the word just shows without a description
  } finally {
    clearTimeout(timer);
  }
}
