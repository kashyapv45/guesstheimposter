// Persistent Fisher-Yates deck: words never repeat until every word in the crate has been played.
export type DeckStore = { played: string[]; queues: Record<string, string[]> };

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const crateKey = (categories: string[]) => [...categories].sort().join("+");

export function draw(store: DeckStore, key: string, pool: string[], rand: () => number = Math.random): { id: string; store: DeckStore } | null {
  if (!pool.length) return null;
  const played = new Set(store.played);
  const inPool = new Set(pool);
  let queue = (store.queues[key] ?? []).filter((id) => inPool.has(id) && !played.has(id));
  if (!queue.length) {
    let fresh = pool.filter((id) => !played.has(id));
    if (!fresh.length) {
      // Crate exhausted: forget its history and start a new shuffle.
      for (const id of pool) played.delete(id);
      fresh = pool;
    }
    queue = shuffle(fresh, rand);
  }
  const [id, ...rest] = queue;
  played.add(id);
  return { id, store: { played: [...played], queues: { ...store.queues, [key]: rest } } };
}

export function reshuffle(store: DeckStore, ids: string[]): DeckStore {
  const drop = new Set(ids);
  return { played: store.played.filter((id) => !drop.has(id)), queues: {} };
}
