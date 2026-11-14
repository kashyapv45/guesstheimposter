"use client";
import { useEffect, useMemo, useState } from "react";
import { crateKey, draw as drawDeck, reshuffle as reshuffleDeck, type DeckStore } from "./deck";
import { CATEGORIES, WORDS, customEntries, decoyFor, type CustomList, type WordEntry } from "./words";

const DECK_KEY = "imposter:deck";
const CUSTOM_KEY = "imposter:custom";

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
  const [custom, setCustom] = useState<CustomList[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage read after hydration
    setStore(load(DECK_KEY, { played: [], queues: {} }));
    setCustom(load(CUSTOM_KEY, []));
  }, []);

  const all = useMemo(() => [...WORDS, ...customEntries(custom)], [custom]);
  const played = useMemo(() => new Set(store.played), [store]);
  const categories = useMemo(
    () => [...CATEGORIES.map((c) => ({ ...c, custom: false })), ...custom.map((c) => ({ id: c.id, name: c.name, custom: true }))],
    [custom],
  );

  const update = (next: DeckStore) => {
    setStore(next);
    save(DECK_KEY, next);
  };
  const updateCustom = (next: CustomList[]) => {
    setCustom(next);
    save(CUSTOM_KEY, next);
  };

  return {
    categories,
    stats(category: string) {
      const words = all.filter((w) => w.category === category);
      return { total: words.length, left: words.filter((w) => !played.has(w.id)).length };
    },
    draw(cats: string[]): WordEntry | null {
      const r = drawDeck(store, crateKey(cats), all.filter((w) => cats.includes(w.category)).map((w) => w.id));
      if (!r) return null;
      update(r.store);
      return all.find((w) => w.id === r.id) ?? null;
    },
    reshuffle(category: string) {
      update(reshuffleDeck(store, all.filter((w) => w.category === category).map((w) => w.id)));
    },
    addCustom(name: string, words: string[]) {
      const id = `custom-${Date.now().toString(36)}`;
      updateCustom([...custom, { id, name, words }]);
      return id;
    },
    removeCustom(id: string) {
      updateCustom(custom.filter((c) => c.id !== id));
    },
    decoy: (w: WordEntry) => decoyFor(w, all),
  };
}

export type WordDeck = ReturnType<typeof useWordDeck>;
