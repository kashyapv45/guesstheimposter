// Tiny key-value store for WebRTC handshakes. Uses Upstash / Vercel KV over REST when configured.
// shortcut: the in-memory fallback only works when one server process handles every request
// (local dev, `next start`); on Vercel set KV_REST_API_URL + KV_REST_API_TOKEN.
type Hash = Record<string, string>;
type KV = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  hset(key: string, field: string, value: string, ttl: number): Promise<void>;
  hgetall(key: string): Promise<Hash>;
  hdel(key: string, fields: string[]): Promise<void>;
};

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis<T>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

const upstash: KV = {
  get: (k) => redis<string | null>("GET", k),
  set: async (k, v, ttl) => void (await redis("SET", k, v, "EX", ttl)),
  del: async (k) => void (await redis("DEL", k)),
  hset: async (k, f, v, ttl) => {
    await redis("HSET", k, f, v);
    await redis("EXPIRE", k, ttl);
  },
  hgetall: async (k) => {
    const flat = (await redis<string[] | null>("HGETALL", k)) ?? [];
    const out: Hash = {};
    for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
  },
  hdel: async (k, fields) => void (fields.length && (await redis("HDEL", k, ...fields))),
};

type Entry = { value: string | Hash; exp: number };
const g = globalThis as unknown as { __imposterKv?: Map<string, Entry> };
const mem = (g.__imposterKv ??= new Map());
const live = (k: string) => {
  const e = mem.get(k);
  if (e && e.exp < Date.now()) mem.delete(k);
  return e && e.exp >= Date.now() ? e : undefined;
};

const memory: KV = {
  get: async (k) => {
    const v = live(k)?.value;
    return typeof v === "string" ? v : null;
  },
  set: async (k, value, ttl) => void mem.set(k, { value, exp: Date.now() + ttl * 1000 }),
  del: async (k) => void mem.delete(k),
  hset: async (k, f, v, ttl) => {
    const cur = live(k)?.value;
    mem.set(k, { value: { ...(typeof cur === "object" ? cur : {}), [f]: v }, exp: Date.now() + ttl * 1000 });
  },
  hgetall: async (k) => {
    const v = live(k)?.value;
    return typeof v === "object" ? { ...v } : {};
  },
  hdel: async (k, fields) => {
    const e = live(k);
    if (e && typeof e.value === "object") for (const f of fields) delete e.value[f];
  },
};

export const kv: KV = URL_ && TOKEN ? upstash : memory;
