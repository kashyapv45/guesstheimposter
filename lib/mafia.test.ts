import { test } from "node:test";
import assert from "node:assert/strict";
import { newMafia, reduceMafia, viewMafia, type MAction, type MState } from "./mafia.ts";

function game(n: number) {
  let s = newMafia();
  for (let i = 0; i < n; i++) s = reduceMafia(s, { type: "join", id: `p${i}`, name: `P${i}` });
  s = reduceMafia(s, { type: "start", seed: 7 });
  return reduceMafia(s, { type: "nightfall" });
}
const who = (s: MState, role: string) => s.alive.filter((id) => s.roles[id] === role);
const run = (s: MState, actions: MAction[]) => actions.reduce(reduceMafia, s);
// Everyone not listed acts as a sleeping villager / no-op pick.
function night(s: MState, picks: Record<string, string>) {
  return run(s, s.alive.map((id) => ({ type: "night", id, target: picks[id] ?? (s.roles[id] === "villager" ? null : s.alive.find((x) => x !== id && s.roles[x] !== "mafia")!) }) as MAction));
}

test("roles: mafia scale with players, plus a doctor and a detective", () => {
  const s = game(6);
  assert.equal(who(s, "mafia").length, 2);
  assert.equal(who(s, "doctor").length, 1);
  assert.equal(who(s, "detective").length, 1);
  assert.equal(s.phase, "night");
});

test("mafia kill unless the doctor saves; detective learns the truth", () => {
  const s = game(6);
  const [m1, m2] = who(s, "mafia");
  const [doc] = who(s, "doctor");
  const [det] = who(s, "detective");
  const victim = who(s, "villager")[0];
  const killed = night(s, { [m1]: victim, [m2]: victim, [doc]: doc, [det]: m1 });
  assert.equal(killed.phase, "morning");
  assert.equal(killed.report!.died, victim);
  assert.ok(!killed.alive.includes(victim));
  assert.deepEqual(killed.checks[det], [{ target: m1, mafia: true }]);

  const saved = night(s, { [m1]: victim, [m2]: victim, [doc]: victim, [det]: m1 });
  assert.equal(saved.report!.died, null);
});

test("voting out the last mafia wins it for the town; ties lynch nobody", () => {
  let s = game(4); // 1 mafia, doctor, detective, villager
  const [m] = who(s, "mafia");
  s = night(s, { [m]: who(s, "villager")[0] });
  s = run(s, [{ type: "discuss", now: 0 }, { type: "startVote" }]);
  const tied = run(s, s.alive.map((id, i) => ({ type: "vote", id, target: i % 2 ? "skip" : s.alive.find((x) => x !== id)! }) as MAction));
  assert.equal(tied.phase === "verdict" || tied.phase === "over", true);
  const won = run(s, s.alive.map((id) => ({ type: "vote", id, target: id === m ? "skip" : m }) as MAction));
  assert.equal(won.phase, "over");
  assert.equal(won.winner, "town");
});

test("mafia win when they equal the town", () => {
  let s = game(4);
  const [m] = who(s, "mafia");
  const [v] = who(s, "villager");
  s = night(s, { [m]: v, [who(s, "doctor")[0]]: who(s, "doctor")[0] }); // doctor saves themself, so the villager dies
  s = run(s, [{ type: "discuss", now: 0 }, { type: "startVote" }]);
  const doc = who(s, "doctor")[0];
  s = run(s, s.alive.map((id) => ({ type: "vote", id, target: id === doc ? who(s, "detective")[0] : doc }) as MAction));
  assert.equal(s.winner, "mafia");
});

test("views hide other roles, but mafia see each other", () => {
  const s = game(6);
  const [m1, m2] = who(s, "mafia");
  const v = who(s, "villager")[0];
  assert.deepEqual(Object.keys(viewMafia(s, v).roles), [v]);
  assert.deepEqual(Object.keys(viewMafia(s, m1).roles).sort(), [m1, m2].sort());
});

test("player can unvote or change vote in town vote", () => {
  let s = game(4);
  const [m] = who(s, "mafia");
  s = night(s, { [m]: who(s, "villager")[0] });
  s = run(s, [{ type: "discuss", now: 0 }, { type: "startVote" }]);
  const voter = s.alive[0];
  const target1 = s.alive[1];
  const target2 = s.alive[2];
  s = reduceMafia(s, { type: "vote", id: voter, target: target1 });
  assert.equal(s.votes[voter], target1);
  s = reduceMafia(s, { type: "unvote", id: voter });
  assert.equal(s.votes[voter], undefined);
  s = reduceMafia(s, { type: "vote", id: voter, target: target2 });
  assert.equal(s.votes[voter], target2);
});

