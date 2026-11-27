// Pure Mafia rules. The PartyKit room server runs this; phones only see their own redacted view.
import { shuffle } from "./deck.ts";

export type MRole = "mafia" | "doctor" | "detective" | "villager";
export type MPhase = "lobby" | "reveal" | "night" | "morning" | "day" | "preliminary" | "vote" | "verdict" | "over";
export type MPlayer = { id: string; name: string; color: string; connected: boolean };
export type MSettings = { mafia: number | null; doctor: boolean; detective: boolean; revealOnDeath: boolean; daySeconds: number; hostIsNarrator?: boolean; preliminaryVote?: boolean };
export type Check = { target: string; mafia: boolean };
export type NightReport = {
  died: string | null;
  mafiaTarget?: string | null;
  doctorTarget?: string | null;
  detectiveTarget?: string | null;
  detectiveMafia?: boolean | null;
};

export type MState = {
  phase: MPhase;
  players: MPlayer[];
  settings: MSettings;
  roles: Record<string, MRole>;
  alive: string[];
  narrator: string | null;
  revealed: string[];
  night: { picks: Record<string, string>; done: string[] }; // picks: actor -> target
  report: NightReport | null; // what happened last night
  checks: Record<string, Check[]>; // detective -> results
  preliminaryVotes: Record<string, string> | null;
  votes: Record<string, string>; // voter -> target id or "skip"
  lynched: { id: string | null } | null;
  day: number;
  timerEnd: number | null;
  winner: "mafia" | "town" | null;
};

export type MAction =
  | { type: "join"; id: string; name: string }
  | { type: "rename"; id: string; name: string }
  | { type: "connected"; id: string; connected: boolean }
  | { type: "leave"; id: string }
  | { type: "settings"; settings: Partial<MSettings> }
  | { type: "start"; seed: number; hostId?: string }
  | { type: "revealed"; id: string }
  | { type: "nightfall" }
  | { type: "night"; id: string; target: string | null }
  | { type: "nightPick"; role: "mafia" | "doctor" | "detective"; target: string | null }
  | { type: "discuss"; now: number }
  | { type: "startPreliminaryVote" }
  | { type: "batchPreliminaryVote"; votes: Record<string, string> }
  | { type: "usePreliminaryAsFinal" }
  | { type: "startVote" }
  | { type: "vote"; id: string; target: string }
  | { type: "unvote"; id: string }
  | { type: "batchVote"; votes: Record<string, string> }
  | { type: "force" } // host: stop waiting (night or vote) when someone left for good
  | { type: "next" };

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;
export const MAFIA_DEFAULTS: MSettings = { mafia: null, doctor: true, detective: true, revealOnDeath: true, daySeconds: 0, hostIsNarrator: true, preliminaryVote: false };
const COLORS = ["#FFB7B2", "#B5EAD7", "#C7CEEA", "#FFDAC1", "#E2F0CB", "#B5D8FA", "#F3C4FB", "#FFE5A3", "#FDE2E4", "#A2E8DD", "#D8B4E2", "#B5E2FA"];

export const recommendMafia = (n: number) => (n >= 9 ? 3 : n >= 6 ? 2 : 1);
export function mafiaCount(s: MSettings, n: number) {
  const max = Math.max(1, Math.floor((n - 1) / 2)); // town must start with the majority
  return Math.min(max, Math.max(1, s.mafia ?? recommendMafia(n)));
}

export function newMafia(settings: MSettings = MAFIA_DEFAULTS): MState {
  return {
    phase: "lobby", players: [], settings, roles: {}, alive: [], narrator: null, revealed: [], night: { picks: {}, done: [] },
    report: null, checks: {}, preliminaryVotes: null, votes: {}, lynched: null, day: 0, timerEnd: null, winner: null,
  };
}

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// The game waits on every living player, connected or not (a locked phone drops its connection);
// the host can force the night or the vote to end if someone left for good.
const waitingOn = (s: MState) => s.alive;

function winnerOf(s: MState): MState["winner"] {
  const mafia = s.alive.filter((id) => s.roles[id] === "mafia").length;
  if (mafia === 0) return "town";
  if (mafia >= s.alive.length - mafia) return "mafia";
  return null;
}

function endOrGo(s: MState, phase: MPhase): MState {
  const winner = winnerOf(s);
  return winner ? { ...s, phase: "over", winner, timerEnd: null } : { ...s, phase };
}

// Plurality pick; ties go to whoever comes first in seat order (keeps the night deterministic).
function plurality(s: MState, picks: string[]): string | null {
  const tally = new Map<string, number>();
  for (const t of picks) tally.set(t, (tally.get(t) ?? 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const id of s.alive) {
    const n = tally.get(id) ?? 0;
    if (n > max) {
      best = id;
      max = n;
    }
  }
  return best;
}

function resolveNight(s: MState, force = false): MState {
  if (s.phase !== "night" || (!force && !waitingOn(s).every((id) => s.night.done.includes(id)))) return s;
  const role = (id: string) => s.roles[id];
  const mafiaTarget = plurality(s, s.alive.filter((id) => role(id) === "mafia" && s.night.picks[id]).map((id) => s.night.picks[id]));
  const doctorActor = s.alive.find((id) => role(id) === "doctor" && s.night.picks[id]);
  const doctorTarget = doctorActor ? s.night.picks[doctorActor] : null;
  const saved = !!mafiaTarget && !!doctorTarget && doctorTarget === mafiaTarget;
  const died = mafiaTarget && !saved ? mafiaTarget : null;
  const checks = { ...s.checks };
  let detectiveTarget: string | null = null;
  let detectiveMafia: boolean | null = null;
  for (const id of s.alive) {
    const t = s.night.picks[id];
    if (role(id) === "detective" && t) {
      const isMafia = role(t) === "mafia";
      checks[id] = [...(checks[id] ?? []), { target: t, mafia: isMafia }];
      detectiveTarget = t;
      detectiveMafia = isMafia;
    }
  }
  return endOrGo(
    {
      ...s,
      alive: died ? s.alive.filter((id) => id !== died) : s.alive,
      checks,
      report: { died, mafiaTarget, doctorTarget, detectiveTarget, detectiveMafia },
      day: s.day + 1,
    },
    "morning",
  );
}

function resolveVote(s: MState, force = false): MState {
  if (s.phase !== "vote" || (!force && !waitingOn(s).every((id) => s.votes[id]))) return s;
  const tally = new Map<string, number>();
  for (const id of s.alive) if (s.votes[id]) tally.set(s.votes[id], (tally.get(s.votes[id]) ?? 0) + 1);
  const max = Math.max(0, ...tally.values());
  const top = [...tally].filter(([, n]) => n === max).map(([t]) => t);
  const out = top.length === 1 && top[0] !== "skip" ? top[0] : null; // a tie or "skip" means nobody goes
  return endOrGo({ ...s, alive: out ? s.alive.filter((a) => a !== out) : s.alive, lynched: { id: out }, timerEnd: null }, "verdict");
}

export function reduceMafia(s: MState, a: MAction): MState {
  switch (a.type) {
    case "join": {
      const name = a.name.trim().slice(0, 20) || "Player";
      if (s.players.some((p) => p.id === a.id)) return { ...s, players: s.players.map((p) => (p.id === a.id ? { ...p, connected: true } : p)) };
      if (s.players.length >= MAX_PLAYERS) return s; // late joiners sit out until the next game
      return { ...s, players: [...s.players, { id: a.id, name, color: COLORS[s.players.length % COLORS.length], connected: true }] };
    }
    case "rename": {
      const name = a.name.trim().slice(0, 20);
      if (!name) return s;
      return { ...s, players: s.players.map((p) => (p.id === a.id ? { ...p, name } : p)) };
    }
    case "connected":
      return resolveVote(resolveNight({ ...s, players: s.players.map((p) => (p.id === a.id ? { ...p, connected: a.connected } : p)) }));
    case "leave":
      return s.phase === "lobby" ? { ...s, players: s.players.filter((p) => p.id !== a.id) } : s;
    case "settings":
      return s.phase === "lobby" ? { ...s, settings: { ...s.settings, ...a.settings } } : s;
    case "start": {
      if (s.phase !== "lobby") return s;
      const connected = s.players.filter((p) => p.connected).map((p) => p.id);
      const narrator = s.settings.hostIsNarrator && a.hostId && connected.includes(a.hostId) ? a.hostId : null;
      const ids = narrator ? connected.filter((id) => id !== narrator) : connected;
      if (ids.length < MIN_PLAYERS) return s;
      const order = shuffle(ids, rng(a.seed));
      const k = mafiaCount(s.settings, ids.length);
      const roles: Record<string, MRole> = {};
      order.forEach((id, i) => (roles[id] = i < k ? "mafia" : "villager"));
      let next = k;
      if (s.settings.doctor && ids.length - next > 1) roles[order[next++]] = "doctor";
      if (s.settings.detective && ids.length - next > 1) roles[order[next++]] = "detective";
      return { ...newMafia(s.settings), players: s.players, phase: "reveal", roles, alive: ids, narrator };
    }
    case "revealed":
      return s.phase === "reveal" && s.roles[a.id] && !s.revealed.includes(a.id) ? { ...s, revealed: [...s.revealed, a.id] } : s;
    case "nightfall":
      return s.phase === "reveal" || s.phase === "verdict"
        ? { ...s, phase: "night", night: { picks: {}, done: [] }, report: null, preliminaryVotes: null, timerEnd: null }
        : s;
    case "night": {
      if (s.phase !== "night" || !s.alive.includes(a.id) || s.night.done.includes(a.id)) return s;
      const role = s.roles[a.id];
      const t = a.target;
      const ok =
        role === "villager" ||
        (t != null && s.alive.includes(t) && (role === "doctor" || (role === "mafia" && s.roles[t] !== "mafia") || (role === "detective" && t !== a.id)));
      if (!ok) return s;
      const picks = role === "villager" || t == null ? s.night.picks : { ...s.night.picks, [a.id]: t };
      return resolveNight({ ...s, night: { picks, done: [...s.night.done, a.id] } });
    }
    case "nightPick": {
      if (s.phase !== "night") return s;
      const actors = s.alive.filter((id) => s.roles[id] === a.role);
      if (!actors.length) return s;
      const t = a.target;
      if (
        t != null &&
        (!s.alive.includes(t) ||
          (a.role === "mafia" && s.roles[t] === "mafia") ||
          (a.role === "detective" && actors.includes(t)))
      ) {
        return s;
      }
      const picks = { ...s.night.picks };
      const done = new Set(s.night.done);
      for (const actor of actors) {
        if (t == null) {
          delete picks[actor];
          done.delete(actor);
        } else {
          picks[actor] = t;
          done.add(actor);
        }
      }
      return { ...s, night: { picks, done: [...done] } };
    }
    case "discuss":
      return s.phase === "morning" ? { ...s, phase: "day", preliminaryVotes: null, timerEnd: s.settings.daySeconds ? a.now + s.settings.daySeconds * 1000 : null } : s;
    case "startPreliminaryVote":
      return s.phase === "day" ? { ...s, phase: "preliminary", votes: {}, timerEnd: null } : s;
    case "batchPreliminaryVote": {
      if (s.phase !== "preliminary") return s;
      const preliminaryVotes: Record<string, string> = {};
      for (const id of s.alive) {
        const target = a.votes[id];
        if (target && target !== id && (target === "skip" || s.alive.includes(target))) {
          preliminaryVotes[id] = target;
        }
      }
      return { ...s, phase: "day", preliminaryVotes, votes: {} };
    }
    case "startVote":
      return s.phase === "day" || s.phase === "preliminary" ? { ...s, phase: "vote", votes: {}, timerEnd: null } : s;
    case "vote": {
      if (s.phase !== "vote" || !s.alive.includes(a.id) || a.target === a.id) return s;
      if (a.target !== "skip" && !s.alive.includes(a.target)) return s;
      return resolveVote({ ...s, votes: { ...s.votes, [a.id]: a.target } });
    }
    case "unvote": {
      if (s.phase !== "vote" || !s.alive.includes(a.id) || !s.votes[a.id]) return s;
      const votes = { ...s.votes };
      delete votes[a.id];
      return { ...s, votes };
    }
    case "batchVote": {
      if (s.phase !== "vote") return s;
      const votes: Record<string, string> = {};
      for (const id of s.alive) {
        const target = a.votes[id];
        if (target && target !== id && (target === "skip" || s.alive.includes(target))) {
          votes[id] = target;
        }
      }
      return resolveVote({ ...s, votes }, true);
    }
    case "usePreliminaryAsFinal": {
      if (s.phase !== "day" || !s.preliminaryVotes) return s;
      const votes: Record<string, string> = {};
      for (const id of s.alive) {
        const target = s.preliminaryVotes[id];
        if (target && target !== id && (target === "skip" || s.alive.includes(target))) {
          votes[id] = target;
        }
      }
      return resolveVote({ ...s, phase: "vote", votes, timerEnd: null }, true);
    }
    case "force":
      return resolveVote(resolveNight(s, true), true);
    case "next":
      return s.phase === "over" ? { ...newMafia(s.settings), players: s.players } : s;
  }
}

// What one player may see: own role, fellow mafia (if mafia), roles of the dead (if revealed on death),
// own night pick (mafia see each other's picks) and own detective results. All is revealed when the game ends.
export function viewMafia(s: MState, id: string): MState {
  if (s.phase === "over" || (s.narrator && id === s.narrator)) return s;
  const me = s.roles[id];
  const roles = Object.fromEntries(
    Object.entries(s.roles).filter(([pid, r]) => pid === id || (me === "mafia" && r === "mafia") || (s.settings.revealOnDeath && !s.alive.includes(pid))),
  );
  const picks = Object.fromEntries(Object.entries(s.night.picks).filter(([pid]) => pid === id || (me === "mafia" && s.roles[pid] === "mafia")));
  const report = s.report ? { died: s.report.died } : null;
  return { ...s, roles, report, night: { ...s.night, picks }, checks: s.checks[id] ? { [id]: s.checks[id] } : {} };
}
