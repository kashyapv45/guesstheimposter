import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, reshuffle, type DeckStore } from "./deck.ts";
import { newGame, reduce, type Action, type GameState } from "./game.ts";

const secret = { word: "Espresso", category: "foods-drinks", categoryName: "Foods & Drinks" };

function game(n: number, extra: Partial<GameState["settings"]> = {}) {
  let s = reduce(newGame(), { type: "settings", settings: extra });
  for (let i = 0; i < n; i++) s = reduce(s, { type: "join", id: `p${i}`, name: `P${i}` });
  s = reduce(s, { type: "start", secret, now: 0, seed: 42 });
  s = reduce(s, { type: "discuss", now: 0 });
  return reduce(s, { type: "startVote" });
}
const ids = (s: GameState, role: string) => Object.keys(s.round!.roles).filter((id) => s.round!.roles[id] === role);
const voteAll = (s: GameState, target: (voter: string) => string) =>
  s.players.reduce((acc, p) => reduce(acc, { type: "vote", voter: p.id, target: target(p.id) } as Action), s);

test("deck never repeats until the crate is exhausted, then reshuffles", () => {
  let store: DeckStore = { played: [], queues: {} };
  const pool = ["a", "b", "c", "d", "e"];
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const r = draw(store, "k", pool)!;
    seen.add(r.id);
    store = r.store;
  }
  assert.equal(seen.size, 5);
  const again = draw(store, "k", pool)!;
  assert.ok(pool.includes(again.id));
  assert.equal(again.store.played.length, 1);
  assert.equal(reshuffle(store, pool).played.length, 0);
  assert.equal(draw(store, "k", []), null);
});

test("roles scale with player count and a crew member opens", () => {
  for (const [n, k] of [[3, 1], [5, 1], [6, 2], [8, 2], [9, 3]]) {
    const s = game(n);
    assert.equal(ids(s, "imposter").length, k, `${n} players`);
    assert.equal(s.round!.roles[s.round!.order[0]], "crew");
  }
  assert.equal(ids(game(6), "crew").length, 4); // only crew and imposters
});

test("catching the imposter wins it for the crew", () => {
  const s = game(4);
  const imp = ids(s, "imposter")[0];
  const crewVoteTarget = (v: string) => (v === imp ? ids(s, "crew")[0] : imp);
  const done = voteAll(s, crewVoteTarget);
  assert.equal(done.phase, "result");
  assert.deepEqual(done.outcome, { eliminated: imp, winner: "crew" });
});

test("a locked phone (disconnected) can't let a minority decide the vote", () => {
  const s = game(5);
  const imp = ids(s, "imposter")[0];
  const crew = ids(s, "crew");
  // two crew phones drop, the rest vote; the imposter's vote alone must not decide it
  let t = reduce(s, { type: "connected", id: crew[0], connected: false });
  t = reduce(t, { type: "connected", id: crew[1], connected: false });
  t = reduce(t, { type: "vote", voter: imp, target: crew[2] });
  t = reduce(t, { type: "vote", voter: crew[2], target: imp });
  t = reduce(t, { type: "vote", voter: crew[3], target: imp });
  assert.equal(t.phase, "vote"); // still waiting for the locked phones
  t = reduce(t, { type: "vote", voter: crew[0], target: imp });
  t = reduce(t, { type: "vote", voter: crew[1], target: imp });
  assert.deepEqual(t.outcome, { eliminated: imp, winner: "crew" });
  // host can count early if someone really left
  let u = reduce(s, { type: "vote", voter: crew[0], target: imp });
  u = reduce(u, { type: "vote", voter: crew[1], target: imp });
  u = reduce(u, { type: "closeVote" });
  assert.deepEqual(u.outcome, { eliminated: imp, winner: "crew" });
});

test("a tie triggers one runoff, a second tie lets imposters escape", () => {
  const s = game(4);
  const [a, b, c, d] = s.players.map((p) => p.id);
  const pairs: Record<string, string> = { [a]: b, [b]: a, [c]: a, [d]: b };
  const runoff = voteAll(s, (v) => pairs[v]);
  assert.equal(runoff.phase, "vote");
  assert.deepEqual([...runoff.candidates!].sort(), [a, b].sort());
  const again = voteAll(runoff, (v) => (v === a ? b : v === b ? a : pairs[v]));
  assert.equal(again.phase, "result");
  assert.equal(again.outcome!.winner, "imposters");
});

test("player rename updates name without changing color or id", () => {
  let s = reduce(newGame(), { type: "join", id: "p1", name: "Alice" });
  assert.equal(s.players[0].name, "Alice");
  const color = s.players[0].color;
  s = reduce(s, { type: "rename", id: "p1", name: "Bob" });
  assert.equal(s.players[0].name, "Bob");
  assert.equal(s.players[0].color, color);
});

test("player can unvote or change vote before resolution", () => {
  const s = game(4);
  const [a, b, c] = s.players.map((p) => p.id);
  let v = reduce(s, { type: "vote", voter: a, target: b });
  assert.equal(v.votes[a], b);
  v = reduce(v, { type: "unvote", voter: a });
  assert.equal(v.votes[a], undefined);
  v = reduce(v, { type: "vote", voter: a, target: c });
  assert.equal(v.votes[a], c);
});



