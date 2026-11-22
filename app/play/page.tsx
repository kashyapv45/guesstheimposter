"use client";
import Link from "next/link";
import { useReducer, useState } from "react";
import { CratePicker, ResultView, SettingsPanel } from "@/components/panels";
import { Button, ConfirmSheet, Screen, Sleeve, Timer, VinylReveal } from "@/components/ui";
import { newGame, reduce, secretFor } from "@/lib/game";
import { useBackGuard } from "@/lib/useBackGuard";
import { useTheme } from "@/lib/theme";
import { useWakeLock } from "@/lib/useWakeLock";
import { noteFor } from "@/lib/words";
import { useWordDeck } from "@/lib/useWordDeck";

export default function PassAndPlay() {
  const deck = useWordDeck();
  const [kit] = useTheme();
  const [s, dispatch] = useReducer(reduce, undefined, () => newGame());
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [ready, setReady] = useState(false); // "I'm <name>" confirmed on a pass-the-phone screen
  const [error, setError] = useState("");
  const playerName = (id: string) => s.players.find((p) => p.id === id)?.name ?? "?";

  useWakeLock(true);

  const start = () => {
    const w = deck.draw(s.settings.categories);
    if (!w) return setError("Pick at least one category.");
    setError("");
    setReady(false);
    const desc = noteFor(w);
    dispatch({ type: "start", secret: { word: w.word, category: w.category, categoryName: w.categoryName, desc }, now: Date.now(), seed: (Math.random() * 2 ** 32) >>> 0 });
  };

  // Phone/browser back mid-round asks before ending it (players are kept).
  const [leaving, setLeaving] = useState(false);
  useBackGuard(s.phase !== "lobby", () => setLeaving(true));

  const screen = (() => {
  if (s.phase === "lobby") {
    const addPlayer = () => {
      if (!name.trim()) return;
      dispatch({ type: "join", id: crypto.randomUUID(), name });
      setName("");
    };
    return (
      <Screen
        title="Pass & Play"
        actions={
          <>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <Button disabled={s.players.length < 3 || !s.settings.categories.length} onClick={start}>
              {s.players.length < 3 ? `Add ${3 - s.players.length} more player${s.players.length === 2 ? "" : "s"}` : s.roundNo ? `${kit.deal}: next round` : kit.deal}
            </Button>
          </>
        }
      >
        <Link href="/" className="font-mono text-xs underline">← Back</Link>
        <Sleeve title={`Players (${s.players.length})`}>
          <ul className="mb-3 space-y-2">
            {s.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 rounded-full border-[length:var(--bw)] border-edge" style={{ background: p.color }} />
                {editingId === p.id ? (
                  <form
                    className="flex flex-1 items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editName.trim()) dispatch({ type: "rename", id: p.id, name: editName });
                      setEditingId(null);
                    }}
                  >
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={20}
                      autoFocus
                      aria-label="New name"
                      className="min-w-0 flex-1 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-2 py-1 text-sm font-bold"
                    />
                    <button
                      type="submit"
                      disabled={!editName.trim()}
                      aria-label="Save name"
                      className="h-9 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-emerald px-2 text-sm font-bold text-on-accent disabled:opacity-40"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel rename"
                      className="h-9 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-2 text-sm"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate font-bold">{p.name}</span>
                    <button
                      type="button"
                      aria-label={`Rename ${p.name}`}
                      onClick={() => {
                        setEditingId(p.id);
                        setEditName(p.name);
                      }}
                      className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field text-sm opacity-70 hover:opacity-100"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => dispatch({ type: "leave", id: p.id })}
                      className="h-10 w-10 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field"
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), addPlayer())}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Player name" aria-label="Player name" className="min-w-0 flex-1 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-3 py-2" />
            <button disabled={!name.trim()} className="rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-well px-4 font-bold text-well-ink disabled:opacity-40">
              Add
            </button>
          </form>
        </Sleeve>
        <SettingsPanel settings={s.settings} players={s.players.length} onChange={(settings) => dispatch({ type: "settings", settings })} />
        <CratePicker deck={deck} selected={s.settings.categories} onChange={(categories) => dispatch({ type: "settings", settings: { categories } })} />
      </Screen>
    );
  }

  const round = s.round!;

  if (s.phase === "reveal") {
    const next = s.players.find((p) => !s.revealed.includes(p.id));
    if (!next)
      return (
        <Screen title="Everyone's in" actions={<Button onClick={() => dispatch({ type: "discuss", now: Date.now() })}>Start the discussion</Button>}>
          <Sleeve>
            <p>Put the phone in the middle. <b>{playerName(round.order[0])}</b> gives the first clue.</p>
          </Sleeve>
        </Screen>
      );
    return (
      <Screen
        title={ready ? `${next.name}'s ${kit.noun}` : "Pass the phone"}
        kicker={`Reveal ${s.revealed.length + 1} of ${s.players.length}`}
        actions={
          ready ? (
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: "revealed", id: next.id });
                setReady(false);
              }}
            >
              Done: hide &amp; pass on
            </Button>
          ) : (
            <Button onClick={() => setReady(true)}>I&apos;m {next.name}</Button>
          )
        }
      >
        {ready ? (
          <VinylReveal secret={secretFor(round, next.id)!} color={next.color} />
        ) : (
          <Sleeve dark>
            <p className="font-serif text-2xl font-bold">Hand the phone to {next.name}.</p>
            <p className="mt-1 opacity-70">No peeking, everyone else.</p>
          </Sleeve>
        )}
      </Screen>
    );
  }

  if (s.phase === "discuss") {
    const turnMode = s.settings.timerMode === "turn";
    const current = turnMode && s.turn < round.order.length ? round.order[s.turn] : null;
    return (
      <Screen
        title="Discussion"
        kicker={`Round ${s.roundNo}`}
        actions={
          <>
            {current && (
              <Button variant="ghost" onClick={() => dispatch({ type: "nextTurn", now: Date.now() })}>
                Next player
              </Button>
            )}
            <Button onClick={() => (setReady(false), dispatch({ type: "startVote" }))}>Start the vote</Button>
          </>
        }
      >
        <Timer
          endAt={s.timerEnd}
          total={turnMode ? s.settings.turnSeconds : s.settings.discussionSeconds}
          caption={current ? `${playerName(current)} is giving a clue` : "Time to talk"}
          onExpire={() => turnMode && dispatch({ type: "nextTurn", now: Date.now() })}
        />
        {s.settings.timerMode !== "off" && s.timerEnd == null && <p className="text-center font-mono text-sm uppercase">Time&apos;s up. Open floor!</p>}
        <Sleeve title="Clue order">
          <ol className="space-y-1">
            {round.order.map((id, i) => (
              <li key={id} className={`rounded px-2 py-1 ${id === current ? "bg-amber font-bold text-on-accent" : ""}`}>
                {i + 1}. {playerName(id)}
              </li>
            ))}
          </ol>
        </Sleeve>
      </Screen>
    );
  }

  if (s.phase === "vote") {
    const voter = s.players.find((p) => !s.votes[p.id])!;
    const options = (s.candidates ?? round.order).filter((id) => id !== voter.id);
    return (
      <Screen title={s.candidates ? "Runoff vote" : "Secret vote"} kicker={`Vote ${Object.keys(s.votes).length + 1} of ${s.players.length}`} actions={!ready && <Button onClick={() => setReady(true)}>I&apos;m {voter.name}</Button>}>
        {s.candidates && (
          <Sleeve>
            <p>It&apos;s a tie! Vote again between {s.candidates.map(playerName).join(" and ")}.</p>
          </Sleeve>
        )}
        {ready ? (
          <Sleeve title={`${voter.name}, who's the imposter?`}>
            <div className="grid gap-2">
              {options.map((id) => (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => {
                    dispatch({ type: "vote", voter: voter.id, target: id });
                    setReady(false);
                  }}
                >
                  {playerName(id)}
                </Button>
              ))}
            </div>
          </Sleeve>
        ) : (
          <Sleeve dark>
            <p className="font-serif text-2xl font-bold">Pass the phone to {voter.name}.</p>
            <p className="mt-1 opacity-70">Votes are secret.</p>
          </Sleeve>
        )}
      </Screen>
    );
  }

  return (
    <Screen title="The verdict" kicker={`Round ${s.roundNo}`} actions={<Button onClick={() => dispatch({ type: "next" })}>{kit.back}</Button>}>
      <ResultView state={s} />
    </Screen>
  );
  })();
  return (
    <>
      {screen}
      <ConfirmSheet
        open={leaving}
        title="End this round?"
        body="You'll go back to setup. Players are kept."
        confirmLabel="Back to setup"
        onConfirm={() => {
          setLeaving(false);
          dispatch({ type: "abort" });
        }}
        onCancel={() => setLeaving(false)}
      />
    </>
  );
}
