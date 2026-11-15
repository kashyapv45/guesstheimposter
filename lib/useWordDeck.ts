"use client";
import { useEffect, useMemo, useState } from "react";
import { crateKey, draw as drawDeck, reshuffle as reshuffleDeck, type DeckStore } from "./deck";
import { CATEGORIES, WORDS, type WordEntry } from "./words";

const DECK_KEY = "imposter:deck";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: play continues, history just isn't kept */
  }
}

export function useWordDeck() {
  const [store, setStore] = useState<DeckStore>({ played: [], queues: {} });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage read after hydration
    setStore(load(DECK_KEY, { played: [], queues: {} }));
  }, []);

  const played = useMemo(() => new Set(store.played), [store]);
  const update = (next: DeckStore) => {
    setStore(next);
    save(DECK_KEY, next);
  };

  return {
    categories: CATEGORIES,
    stats(category: string) {
      const words = WORDS.filter((w) => w.category === category);
      return { total: words.length, left: words.filter((w) => !played.has(w.id)).length };
    },
    draw(cats: string[]): WordEntry | null {
      const r = drawDeck(store, crateKey(cats), WORDS.filter((w) => cats.includes(w.category)).map((w) => w.id));
      if (!r) return null;
      update(r.store);
      return WORDS.find((w) => w.id === r.id) ?? null;
    },
    reshuffle(category: string) {
      update(reshuffleDeck(store, WORDS.filter((w) => w.category === category).map((w) => w.id)));
    },
  };
}

export type WordDeck = ReturnType<typeof useWordDeck>;
