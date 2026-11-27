"use client";
// The in-round screens for networked play (host and guests share it; host gets extra controls).
import { useState } from "react";
import type { Action, GameState, Secret } from "@/lib/game";
import { hapticConfirm } from "@/lib/haptics";
import { ResultView } from "./panels";
import { Button, Screen, Sleeve, Timer, VinylReveal } from "./ui";

type Seat = { id: string; name: string; color: string; connected: boolean };
export function PlayerList({
  players,
  showLinks,
  me,
  canRename,
  onRename,
  onRemove,
}: {
  players: Seat[];
  showLinks?: boolean;
  me?: string;
  canRename?: (id: string) => boolean;
  onRename?: (id: string, name: string) => void;
  onRemove?: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  return (
    <ul className="space-y-2">
      {players.map((p) => (
        <li key={p.id} className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full border-[length:var(--bw)] border-edge" style={{ background: p.color }} />
          {editingId === p.id && onRename ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = editName.trim();
                if (trimmed) onRename(p.id, trimmed);
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
                className="h-9 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-emerald px-2.5 text-base font-black text-on-accent disabled:opacity-40"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                aria-label="Cancel rename"
                className="h-9 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-2.5 text-base font-black"
              >
                ✕
              </button>
            </form>
          ) : (
            <>
              <span className="flex-1 truncate font-bold">
                {p.name}
                {p.id === me && <span className="ml-1 font-mono text-xs font-normal opacity-60">(you)</span>}
              </span>
              {showLinks && <span role="img" aria-label={p.connected ? "connected" : "disconnected"} className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.connected ? "bg-emerald shadow-[0_0_8px_var(--emerald)]" : "bg-edge"}`} />}
              {onRename && (!canRename || canRename(p.id)) && (
                <button
                  type="button"
                  aria-label={`Rename ${p.name}`}
                  onClick={() => {
                    setEditingId(p.id);
                    setEditName(p.name);
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field text-base font-black opacity-85 hover:opacity-100"
                >
                  ✎
                </button>
              )}
              {onRemove && p.id !== me && (
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => onRemove(p.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field text-base font-black opacity-85 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PreliminaryResults({ votes, nameOf }: { votes: Record<string, string>; nameOf: (id: string) => string }) {
  const tally = new Map<string, number>();
  for (const t of Object.values(votes)) tally.set(t, (tally.get(t) ?? 0) + 1);
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <Sleeve title="Preliminary vote · Debate">
      <div className="space-y-3 text-sm">
        {sorted.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map(([t, n]) => (
              <span key={t} className="rounded-full border border-edge bg-field px-2.5 py-0.5 font-mono text-xs font-bold">
                {t === "skip" ? "Skip" : nameOf(t)}: {n}
              </span>
            ))}
          </div>
        )}
        <ul className="space-y-1 opacity-85">
          {Object.entries(votes).map(([voter, target], i) => (
            <li key={voter} className="flex justify-between gap-2">
              <span className="truncate">{i + 1}. {nameOf(voter)}</span>
              <span className="font-mono text-xs font-bold">→ {target === "skip" ? "Skip" : nameOf(target)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sleeve>
  );
}

export function HostBatchVote({
  voters,
  targets,
  nameOf,
  allowSkip,
  initialVotes,
  submitLabel,
  onSubmit,
}: {
  voters: string[];
  targets: string[];
  nameOf: (id: string) => string;
  allowSkip?: boolean;
  initialVotes?: Record<string, string>;
  submitLabel: string;
  onSubmit: (votes: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => initialVotes ?? {});
  const allPicked = voters.every((id) => !!draft[id]);
  return (
    <Sleeve title="Host vote entry">
      <div className="space-y-3">
        <ol className="space-y-2.5">
          {voters.map((voterId, i) => {
            const opts = targets.filter((t) => t !== voterId);
            return (
              <li key={voterId} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field/60 p-2.5">
                <span className="text-sm font-bold">
                  {i + 1}. {nameOf(voterId)} voting for
                </span>
                <select
                  aria-label={`${nameOf(voterId)} voting for`}
                  value={draft[voterId] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [voterId]: e.target.value }))}
                  className="min-w-[10rem] rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-2.5 py-1.5 text-sm font-bold text-ink"
                >
                  <option value="">Choose from list…</option>
                  {opts.map((t) => (
                    <option key={t} value={t}>
                      {nameOf(t)}
                    </option>
                  ))}
                  {allowSkip && <option value="skip">Skip vote</option>}
                </select>
              </li>
            );
          })}
        </ol>
        <Button
          disabled={!allPicked}
          onClick={() => {
            hapticConfirm();
            onSubmit(draft);
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </Sleeve>
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
          <PlayerList
            players={state.players}
            me={me}
            canRename={(id) => id === me}
            onRename={state.settings.allowRename !== false ? (id, newName) => act({ type: "rename", id, name: newName }) : undefined}
          />
        </Sleeve>
        <p className="text-center font-mono text-sm uppercase tracking-widest">Waiting for the host to drop the needle…</p>
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
              {state.settings.preliminaryVote && (
                <Button variant="secondary" onClick={() => act({ type: "startPreliminaryVote" })}>
                  {state.preliminaryVotes ? "Re-run preliminary vote" : "Start preliminary vote"}
                </Button>
              )}
              {state.preliminaryVotes && (
                <Button variant="teal" onClick={() => act({ type: "usePreliminaryAsFinal" })}>
                  Use preliminary votes as final votes
                </Button>
              )}
              <Button onClick={() => act({ type: "startVote" })}>{state.settings.preliminaryVote ? "Start final vote" : "Start the vote"}</Button>
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
        {state.preliminaryVotes && <PreliminaryResults votes={state.preliminaryVotes} nameOf={name} />}
        <Sleeve title="Clue order">
          <ol className="space-y-1">
            {round.order.map((id, i) => (
              <li key={id} className={`rounded px-2 py-1 ${id === current ? "bg-amber font-bold text-on-accent" : ""}`}>
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

  if (state.phase === "preliminary") {
    return (
      <Screen
        title="Preliminary vote"
        kicker="For debate before final vote"
        actions={isHost && <Button variant="ghost" onClick={() => act({ type: "startVote" })}>Skip to final vote</Button>}
      >
        {isHost ? (
          <HostBatchVote
            voters={round.order}
            targets={round.order}
            nameOf={name}
            submitLabel="Show preliminary results"
            onSubmit={(votes) => act({ type: "batchPreliminaryVote", votes })}
          />
        ) : (
          <Sleeve dark>
            <p className="font-serif text-xl font-bold">Preliminary vote in progress.</p>
            <p className="opacity-70">Tell the host who you suspect — the host is entering everyone&apos;s votes.</p>
          </Sleeve>
        )}
      </Screen>
    );
  }

  if (state.phase === "vote") {
    const targets = state.candidates ?? round.order;
    return (
      <Screen title={state.candidates ? "Runoff vote" : "Final vote"} kicker={`Round ${state.roundNo}`}>
        {state.candidates && (
          <Sleeve>
            <p>Tie! Vote again between {state.candidates.map(name).join(" and ")}.</p>
          </Sleeve>
        )}
        {isHost ? (
          <HostBatchVote
            key={state.candidates ? state.candidates.join(",") : "final"}
            voters={round.order}
            targets={targets}
            nameOf={name}
            initialVotes={state.candidates ? undefined : (state.preliminaryVotes ?? undefined)}
            submitLabel="Submit all votes"
            onSubmit={(votes) => act({ type: "batchVote", votes })}
          />
        ) : (
          <Sleeve dark>
            <p className="font-serif text-xl font-bold">Final vote in progress.</p>
            <p className="opacity-70">Waiting for the host to enter everyone&apos;s votes…</p>
          </Sleeve>
        )}
      </Screen>
    );
  }

  return (
    <Screen title="The verdict" kicker={`Round ${state.roundNo}`} actions={isHost && <Button onClick={() => act({ type: "next" })}>Back to the lobby</Button>}>
      <ResultView state={state} />
    </Screen>
  );
}
