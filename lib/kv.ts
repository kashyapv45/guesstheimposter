// Tiny key-value store for WebRTC handshakes. Picks the first one configured:
//   1. Upstash / Vercel KV over REST  (KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + _TOKEN)
//   2. Any Redis over TCP             (REDIS_URL, or KV_URL) - what Vercel's "Redis" storage option sets
//   3. In-memory                      only safe when one process serves every request (local dev, `next start`)
type Hash = Record<string, string>;
type KV = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  hset(key: string, field: string, value: string, ttl: number): Promise<void>;
  hgetall(key: string): Promise<Hash>;
  hdel(key: string, fields: string[]): Promise<void>;
};

const REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const TCP_URL = process.env.REDIS_URL ?? process.env.KV_URL;

export const kvKind: "upstash" | "redis" | "memory" = REST_URL && REST_TOKEN ? "upstash" : TCP_URL ? "redis" : "memory";

type TcpClient = { isOpen: boolean; connect(): Promise<unknown>; sendCommand(args: string[]): Promise<unknown> };
const g = globalThis as unknown as { __imposterKv?: Map<string, Entry>; __imposterRedis?: Promise<TcpClient> };

function tcp(): Promise<TcpClient> {
  // One connection per warm serverless instance.
  g.__imposterRedis ??= import("redis").then(async ({ createClient }) => {
    const c = createClient({ url: TCP_URL });
    c.on("error", () => {}); // reconnects on its own; a failed command still throws to the caller
    await c.connect();
    return c as unknown as TcpClient;
  });
  return g.__imposterRedis.catch((e) => {
    g.__imposterRedis = undefined; // retry the connection on the next request
    throw e;
  });
}

async function exec<T>(...cmd: (string | number)[]): Promise<T> {
  if (kvKind === "redis") return (await (await tcp()).sendCommand(cmd.map(String))) as T;
  const res = await fetch(REST_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

const redis: KV = {
  get: (k) => exec<string | null>("GET", k),
  set: async (k, v, ttl) => void (await exec("SET", k, v, "EX", ttl)),
  del: async (k) => void (await exec("DEL", k)),
  hset: async (k, f, v, ttl) => {
    await exec("HSET", k, f, v);
    await exec("EXPIRE", k, ttl);
  },
  hgetall: async (k) => {
    const raw = await exec<string[] | Hash | null>("HGETALL", k);
    if (!raw) return {};
    if (!Array.isArray(raw)) return raw;
    const out: Hash = {};
    for (let i = 0; i + 1 < raw.length; i += 2) out[raw[i]] = raw[i + 1];
    return out;
  },
  hdel: async (k, fields) => void (fields.length && (await exec("HDEL", k, ...fields))),
};

type Entry = { value: string | Hash; exp: number };
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

export const kv: KV = kvKind === "memory" ? memory : redis;
