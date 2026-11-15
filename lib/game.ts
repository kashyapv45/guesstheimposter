// Pure game rules for Pass & Play.
import { shuffle } from "./deck.ts";

export type Role = "crew" | "imposter";
export type TimerMode = "off" | "discussion" | "turn";
export type Phase = "lobby" | "reveal" | "discuss" | "vote" | "result";

export type Settings = {
  categories: string[];
  imposters: number | null; // null = auto
  timerMode: TimerMode;
  discussionSeconds: number;
  turnSeconds: number;
};

export const DEFAULT_SETTINGS: Settings = {
  categories: ["foods-drinks", "animals", "everyday-objects"],
  imposters: null,
  timerMode: "off",
  discussionSeconds: 180,
  turnSeconds: 30,
};

export type Player = { id: string; name: string; color: string; connected: boolean };
export type SecretWord = { word: string; category: string; categoryName: string; desc?: string | null };
export type Round = SecretWord & { roles: Record<string, Role>; order: string[] };
export type Outcome = { eliminated: string | null; winner: "crew" | "imposters" };

export type GameState = {
  phase: Phase;
  players: Player[];
  settings: Settings;
  round: Round | null;
  revealed: string[];
  votes: Record<string, string>;
  candidates: string[] | null; // set during a tie-break runoff
  outcome: Outcome | null;
  turn: number;
  timerEnd: number | null;
  roundNo: number;
};

export type Action =
  | { type: "join"; id: string; name: string }
  | { type: "leave"; id: string }
  | { type: "connected"; id: string; connected: boolean }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "start"; secret: SecretWord; now: number; seed: number }
  | { type: "revealed"; id: string }
  | { type: "discuss"; now: number }
  | { type: "nextTurn"; now: number }
  | { type: "startVote" }
  | { type: "vote"; voter: string; target: string }
  | { type: "closeVote" } // host: count the votes cast so far (someone left for good)
  | { type: "next" };

export type Secret = { role: Role; word: string | null; category: string | null; desc?: string | null };

export const COLORS = ["#D95D39", "#E9B44C", "#2A9D8F", "#8E5572", "#3D5A80", "#7FB069", "#E07A5F", "#6D597A", "#BC4749", "#457B9D", "#F2CC8F", "#264653"];
export const MAX_PLAYERS = 16;

export function newGame(settings: Settings = DEFAULT_SETTINGS): GameState {
  return {
    phase: "lobby", players: [], settings, round: null, revealed: [], votes: {}, candidates: null,
    outcome: null, turn: 0, timerEnd: null, roundNo: 0,
  };
}

export const recommendImposters = (n: number) => (n >= 9 ? 3 : n >= 6 ? 2 : 1);

export function imposterCount(s: Settings, n: number) {
  const max = Math.max(1, Math.floor((n - 1) / 2)); // crew must outnumber imposters
  return Math.min(max, Math.max(1, s.imposters ?? recommendImposters(n)));
}

export const normalizeWord = (w: string) =>
  w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const activeIds = (s: GameState) => s.players.filter((p) => p.connected).map((p) => p.id);

function finish(s: GameState, outcome: Outcome): GameState {
  return { ...s, phase: "result", outcome, timerEnd: null };
}

// Waits for every player dealt into the round, connected or not: a phone that locks mid-vote
// drops its connection, and skipping it used to decide the vote without them.
function resolveIfDone(s: GameState, force = false): GameState {
  if (s.phase !== "vote" || !s.round) return s;
  const dealt = Object.keys(s.round.roles);
  if (!force && !dealt.every((id) => s.votes[id])) return s;
  const voters = dealt.filter((id) => s.votes[id]);
  if (!voters.length) return s;
  const tally: Record<string, number> = {};
  for (const id of voters) tally[s.votes[id]] = (tally[s.votes[id]] ?? 0) + 1;
  const max = Math.max(...Object.values(tally));
  const top = Object.keys(tally).filter((id) => tally[id] === max);
  if (top.length > 1) {
    if (!s.candidates) return { ...s, votes: {}, candidates: top }; // one runoff between the tied players
    return finish(s, { eliminated: null, winner: "imposters" }); // still tied: imposters slip away
  }
  const eliminated = top[0];
  const role = s.round.roles[eliminated];
  return finish(s, { eliminated, winner: role === "imposter" ? "crew" : "imposters" });
}

export function reduce(s: GameState, a: Action): GameState {
  switch (a.type) {
    case "join": {
      const name = a.name.trim().slice(0, 20) || "Player";
      if (s.players.some((p) => p.id === a.id))
        return { ...s, players: s.players.map((p) => (p.id === a.id ? { ...p, name, connected: true } : p)) };
      if (s.players.length >= MAX_PLAYERS) return s; // late joiners sit out until the next deal
      const color = COLORS[s.players.length % COLORS.length];
      return { ...s, players: [...s.players, { id: a.id, name, color, connected: true }] };
    }
    case "leave":
      return s.phase === "lobby" ? { ...s, players: s.players.filter((p) => p.id !== a.id) } : s;
    case "connected":
      return resolveIfDone({ ...s, players: s.players.map((p) => (p.id === a.id ? { ...p, connected: a.connected } : p)) });
    case "settings":
      return s.phase === "lobby" ? { ...s, settings: { ...s.settings, ...a.settings } } : s;
    case "start": {
      if (s.phase !== "lobby") return s;
      const ids = activeIds(s);
      if (ids.length < 3) return s;
      const rand = rng(a.seed);
      const k = imposterCount(s.settings, ids.length);
      const roles: Record<string, Role> = {};
      shuffle(ids, rand).forEach((id, i) => {
        roles[id] = i < k ? "imposter" : "crew";
      });
      const order = shuffle(ids, rand);
      order.unshift(...order.splice(order.findIndex((id) => roles[id] === "crew"), 1)); // a crew member opens
      return {
        ...s, phase: "reveal", round: { ...a.secret, roles, order }, revealed: [], votes: {}, candidates: null,
        outcome: null, turn: 0, timerEnd: null, roundNo: s.roundNo + 1,
      };
    }
    case "revealed":
      if (s.phase !== "reveal" || !s.round?.roles[a.id] || s.revealed.includes(a.id)) return s;
      return { ...s, revealed: [...s.revealed, a.id] };
    case "discuss": {
      if (s.phase !== "reveal") return s;
      const t = s.settings;
      const secs = t.timerMode === "discussion" ? t.discussionSeconds : t.timerMode === "turn" ? t.turnSeconds : 0;
      return { ...s, phase: "discuss", turn: 0, timerEnd: secs ? a.now + secs * 1000 : null };
    }
    case "nextTurn": {
      if (s.phase !== "discuss" || s.settings.timerMode !== "turn" || !s.round) return s;
      const turn = s.turn + 1;
      return { ...s, turn, timerEnd: turn < s.round.order.length ? a.now + s.settings.turnSeconds * 1000 : null };
    }
    case "startVote":
      return s.phase === "discuss" ? { ...s, phase: "vote", votes: {}, candidates: null, timerEnd: null } : s;
    case "vote": {
      if (s.phase !== "vote" || !s.round || !s.round.roles[a.voter] || a.voter === a.target || s.votes[a.voter]) return s;
      const allowed = s.candidates ?? s.round.order;
      if (!allowed.includes(a.target)) return s;
      return resolveIfDone({ ...s, votes: { ...s.votes, [a.voter]: a.target } });
    }
    case "closeVote":
      return resolveIfDone(s, true);
    case "next":
      if (s.phase !== "result") return s;
      return { ...s, phase: "lobby", round: null, revealed: [], votes: {}, candidates: null, outcome: null, turn: 0, timerEnd: null };
  }
}

// Crew get the word (and its description); the imposter gets only the category.
export function secretFor(round: Round, id: string): Secret | null {
  const role = round.roles[id];
  if (!role) return null;
  if (role === "crew") return { role, word: round.word, category: round.categoryName, desc: round.desc ?? null };
  return { role, word: null, category: round.categoryName };
}

// What one remote player may see: their own secret, no one else's role, anonymous votes.
export function viewFor(s: GameState, id: string): { state: GameState; secret: Secret | null } {
  if (!s.round) return { state: s, secret: null };
  const secret = secretFor(s.round, id);
  if (s.phase === "result") return { state: s, secret };
  const votes = Object.fromEntries(Object.keys(s.votes).map((v) => [v, v === id ? s.votes[v] : "?"]));
  return {
    state: { ...s, votes, round: { ...s.round, word: "", category: "", categoryName: "", desc: null, roles: {} } },
    secret,
  };
}
