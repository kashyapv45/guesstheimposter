"use client";
// The in-round screens for networked play (host and guests share it; host gets extra controls).
import type { Action, GameState, Secret } from "@/lib/game";
import { ResultView, Scoreboard } from "./panels";
import { Button, Led, Screen, Sleeve, Timer, VinylReveal } from "./ui";

export function PlayerList({ state, showLinks }: { state: GameState; showLinks?: boolean }) {
  return (
    <ul className="space-y-2">
      {state.players.map((p) => (
        <li key={p.id} className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-edge" style={{ background: p.color }} />
          <span className="flex-1 truncate font-bold">{p.name}</span>
          {showLinks && <Led color={p.connected ? "green" : "off"} label={p.connected ? "connected on Wi-Fi" : "disconnected"} />}
        </li>
      ))}
    </ul>
  );
}

export function GameView({ state, secret, me, isHost, act }: { state: GameState; secret: Secret | null; me: string; isHost: boolean; act: (a: Action) => void }) {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "?";
  const color = state.players.find((p) => p.id === me)?.color ?? "#F59E0B";
  const round = state.round;

  if (state.phase === "lobby" || !round)
    return (
      <Screen title="In the crate" kicker={state.roundNo ? `After round ${state.roundNo}` : "Waiting room"}>
        <Sleeve title={`Players (${state.players.length})`}>
          <PlayerList state={state} />
        </Sleeve>
        <p className="text-center font-mono text-sm uppercase tracking-widest">Waiting for the host to drop the needle…</p>
        {state.roundNo > 0 && <Scoreboard state={state} />}
      </Screen>
    );

  if (!secret)
    return (
      <Screen title="Round in progress">
        <Sleeve>
          <p>This round started before you joined. You&apos;ll be dealt in next round.</p>
        </Sleeve>
      </Screen>
    );

  if (state.phase === "reveal")
    return (
      <Screen
        title="Your record"
        kicker={`${state.revealed.length} / ${round.order.length} have looked`}
        actions={isHost && <Button onClick={() => act({ type: "discuss", now: Date.now() })}>{state.revealed.length < round.order.length ? "Start discussion anyway" : "Start the discussion"}</Button>}
      >
        <VinylReveal secret={secret} color={color} onReveal={() => act({ type: "revealed", id: me })} />
        <p className="text-center text-sm">
          <b>{name(round.order[0])}</b> gives the first clue.
        </p>
      </Screen>
    );

  if (state.phase === "discuss") {
    const turnMode = state.settings.timerMode === "turn";
    const current = turnMode && state.turn < round.order.length ? round.order[state.turn] : null;
    return (
      <Screen
        title="Discussion"
        kicker={`Round ${state.roundNo}`}
        actions={
          isHost && (
            <>
              {current && (
                <Button variant="ghost" onClick={() => act({ type: "nextTurn", now: Date.now() })}>
                  Next player
                </Button>
              )}
              <Button onClick={() => act({ type: "startVote" })}>Start the vote</Button>
            </>
          )
        }
      >
        <Timer
          endAt={state.timerEnd}
          total={turnMode ? state.settings.turnSeconds : state.settings.discussionSeconds}
          caption={current ? (current === me ? "Your clue!" : `${name(current)} is giving a clue`) : "Time to talk"}
          onExpire={() => isHost && turnMode && act({ type: "nextTurn", now: Date.now() })}
        />
        {state.settings.timerMode !== "off" && state.timerEnd == null && <p className="text-center font-mono text-sm uppercase">Time&apos;s up. Open floor!</p>}
        <Sleeve title="Clue order">
          <ol className="space-y-1">
            {round.order.map((id, i) => (
              <li key={id} className={`rounded px-2 py-1 ${id === current ? "bg-amber font-bold text-chassis" : ""}`}>
                {i + 1}. {name(id)}
                {id === me && " (you)"}
              </li>
            ))}
          </ol>
        </Sleeve>
        <details>
          <summary className="cursor-pointer font-mono text-xs uppercase">Peek at my record again</summary>
          <div className="pt-3">
            <VinylReveal secret={secret} color={color} />
          </div>
        </details>
      </Screen>
    );
  }

  if (state.phase === "vote") {
    const mine = state.votes[me];
    const options = (state.candidates ?? round.order).filter((id) => id !== me);
    return (
      <Screen title={state.candidates ? "Runoff vote" : "Vote"} kicker={`${Object.keys(state.votes).length} / ${round.order.length} voted`}>
        {state.candidates && (
          <Sleeve>
            <p>Tie! Vote again between {state.candidates.map(name).join(" and ")}.</p>
          </Sleeve>
        )}
        {mine ? (
          <Sleeve dark>
            <p className="font-serif text-xl font-bold">You voted for {name(mine)}.</p>
            <p className="opacity-70">Waiting for everyone else…</p>
          </Sleeve>
        ) : (
          <Sleeve title="Who's the imposter?">
            <div className="grid gap-2">
              {options.map((id) => (
                <Button key={id} variant="ghost" onClick={() => act({ type: "vote", voter: me, target: id })}>
                  {name(id)}
                </Button>
              ))}
            </div>
          </Sleeve>
        )}
      </Screen>
    );
  }

  return (
    <Screen title="The verdict" kicker={`Round ${state.roundNo}`} actions={isHost && !state.awaitingGuess && <Button onClick={() => act({ type: "next" })}>Back to the lobby</Button>}>
      <ResultView state={state} canGuess={state.outcome?.eliminated === me} onGuess={(word) => act({ type: "guess", id: me, word })} />
      {!state.awaitingGuess && <Scoreboard state={state} />}
    </Screen>
  );
}
