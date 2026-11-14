// Per-tab saved sessions (host room, guest seat) that expire after 1 hour without game activity.
export const IDLE_MS = 60 * 60 * 1000;
export const HOST_KEY = "imposter:host";
export const guestKey = (code: string) => `imposter:guest:${code}`;

type Stored<T> = { at: number; data: T };

export function loadSession<T>(key: string): T | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? "null") as Stored<T> | null;
    if (v && typeof v.at === "number" && Date.now() - v.at < IDLE_MS) return v.data;
    sessionStorage.removeItem(key);
  } catch {}
  return null;
}

// Saving = activity: it restarts the 1-hour clock.
export function saveSession<T>(key: string, data: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data } satisfies Stored<T>));
  } catch {}
}

export function clearSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
