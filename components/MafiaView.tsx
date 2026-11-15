"use client";
// Mafia screens for every phase. The app is the moderator; each phone only knows what its player may know.
import type { MAction, MRole, MState } from "@/lib/mafia";
import { PlayerList } from "./GameView";
import { Button, Screen, Sleeve, Timer, VinylReveal } from "./ui";

const ROLE: Record<MRole, { name: string; blurb: string }> = {
  mafia: { name: "Mafia", blurb: "Each night, agree with your team on someone to eliminate. By day, blend in." },
  doctor: { name: "Doctor", blurb: "Each night, pick one player to save. You may save yourself." },
  detective: { name: "Detective", blurb: "Each night, check one player to learn if they're Mafia." },
  villager: { name: "Villager", blurb: "Find the Mafia by talking, and vote them out by day." },
};

export function MafiaView({ state, me, isHost, act }: { state: MState; me: string; isHost: boolean; act: (a: MAction) => void }) {
  const name = (id: string | null | undefined) => state.players.find((p) => p.id === id)?.name ?? "?";
  const roleOf = (id: string) => state.roles[id];
  const myRole = state.roles[me];
  const alive = state.alive.includes(me);
  const color = state.players.find((p) => p.id === me)?.color ?? "var(--amber)";
  const team = Object.keys(state.roles).filter((id) => id !== me && state.roles[id] === "mafia");
  // Actions are built at tap time (e.g. the day timer's start time), not while rendering.
  const hostButton = (label: string, a: () => MAction) => isHost && <Button onClick={() => act(a())}>{label}</Button>;
  const deadNote = !alive && myRole && state.phase !== "lobby" && (
    <Sleeve dark>
      <p className="font-serif text-xl font-bold">You&apos;re out.</p>
      <p className="opacity-70">Stay quiet and watch the rest unfold.</p>
    </Sleeve>
  );

  if (state.phase === "lobby" || !myRole)
    return (
      <Screen title="Mafia" kicker={state.phase === "lobby" ? "Waiting room" : "Game in progress"}>
        <Sleeve title={`Players (${state.players.length})`}>
          <PlayerList players={state.players} />
        </Sleeve>
        <p className="text-center font-mono text-sm uppercase tracking-widest">
          {state.phase === "lobby" ? "Waiting for the host to deal the roles…" : "This game started before you joined. You'll play the next one."}
        </p>
      </Screen>
    );

  if (state.phase === "reveal")
    return (
      <Screen
        title="Your role"
        kicker={`${state.revealed.length} / ${state.alive.length} have looked`}
        actions={hostButton(state.revealed.length < state.alive.length ? "Night falls anyway" : "Night falls", () => ({ type: "nightfall" }))}
      >
        <VinylReveal
          color={color}
          alert={myRole === "mafia"}
          onReveal={() => act({ type: "revealed", id: me })}
          content={
            <>
              <p className="font-serif text-2xl font-black uppercase leading-tight">{ROLE[myRole].name}</p>
              <p className="max-w-[13rem] text-[11px] leading-snug">{ROLE[myRole].blurb}</p>
              {myRole === "mafia" && team.length > 0 && <p className="text-xs font-bold">Team: {team.map(name).join(", ")}</p>}
            </>
          }
        />
      </Screen>
    );

  if (state.phase === "night") {
    const done = state.night.done.includes(me);
    const myPick = state.night.picks[me];
    const options = state.alive.filter((id) => (myRole === "mafia" ? roleOf(id) !== "mafia" && !team.includes(id) && id !== me : myRole === "detective" ? id !== me : true));
    const prompt = myRole === "mafia" ? "Who does the Mafia eliminate?" : myRole === "doctor" ? "Who do you save tonight?" : myRole === "detective" ? "Who do you check?" : null;
    return (
      <Screen
        title={`Night ${state.day + 1}`}
        kicker={`${state.night.done.length} / ${state.alive.length} ready`}
        actions={isHost && state.night.done.length < state.alive.length && <Button variant="secondary" onClick={() => act({ type: "force" })}>Stop waiting: end the night</Button>}
      >
        {deadNote ||
          (done ? (
            <Sleeve dark>
              <p className="font-serif text-xl font-bold">{myPick ? `You chose ${name(myPick)}.` : "Sleeping…"}</p>
              <p className="opacity-70">Waiting for the night to end.</p>
            </Sleeve>
          ) : prompt ? (
            <Sleeve title={prompt}>
              {myRole === "mafia" && team.length > 0 && (
                <p className="mb-3 text-sm">
                  Team picks:{" "}
                  {team.map((id) => `${name(id)} → ${state.night.picks[id] ? name(state.night.picks[id]) : "…"}`).join(" · ")}
                </p>
              )}
              <div className="grid gap-2">
                {options.map((id) => (
                  <Button key={id} variant="ghost" onClick={() => act({ type: "night", id: me, target: id })}>
                    {name(id)}
                    {id === me && " (you)"}
                  </Button>
                ))}
              </div>
            </Sleeve>
          ) : (
            <Sleeve dark>
              <p className="font-serif text-xl font-bold">Close your eyes.</p>
              <p className="mb-3 opacity-70">The town sleeps. Tap so the night can move on.</p>
              <Button variant="secondary" onClick={() => act({ type: "night", id: me, target: null })}>
                I&apos;m asleep
              </Button>
            </Sleeve>
          ))}
      </Screen>
    );
  }

  if (state.phase === "morning") {
    const died = state.report?.died;
    const lastCheck = state.checks[me]?.at(-1);
    return (
      <Screen title={`Day ${state.day}`} kicker="Morning" actions={isHost && <Button onClick={() => act({ type: "discuss", now: Date.now() })}>Start the discussion</Button>}>
        <Sleeve dark>
          <p className="font-serif text-2xl font-black">{died ? `${name(died)} was eliminated in the night.` : "Nobody died last night."}</p>
          {died && roleOf(died) && <p className="mt-1 opacity-80">They were {ROLE[roleOf(died)].name}.</p>}
        </Sleeve>
        {myRole === "detective" && alive && lastCheck && (
          <Sleeve title="Your investigation">
            <p className="font-bold">
              {name(lastCheck.target)} is {lastCheck.mafia ? <span className="text-crimson">Mafia</span> : "not Mafia"}.
            </p>
          </Sleeve>
        )}
        {deadNote}
      </Screen>
    );
  }

  if (state.phase === "day")
    return (
      <Screen title={`Day ${state.day}`} kicker="Discussion" actions={hostButton("Start the vote", () => ({ type: "startVote" }))}>
        <Timer endAt={state.timerEnd} total={state.settings.daySeconds} caption="Talk it out" />
        <Sleeve title={`Still in (${state.alive.length})`}>
          <PlayerList players={state.players.filter((p) => state.alive.includes(p.id))} />
        </Sleeve>
        {myRole === "detective" && alive && (state.checks[me]?.length ?? 0) > 0 && (
          <Sleeve title="Your notes">
            <ul className="space-y-1 text-sm">
              {state.checks[me].map((c, i) => (
                <li key={i}>
                  {name(c.target)}: {c.mafia ? <b className="text-crimson">Mafia</b> : "not Mafia"}
                </li>
              ))}
            </ul>
          </Sleeve>
        )}
        {deadNote}
      </Screen>
    );

  if (state.phase === "vote") {
    const mine = state.votes[me];
    return (
      <Screen
        title="Town vote"
        kicker={`${Object.keys(state.votes).length} / ${state.alive.length} voted`}
        actions={isHost && Object.keys(state.votes).length < state.alive.length && <Button variant="secondary" onClick={() => act({ type: "force" })}>Count the votes now</Button>}
      >
        {deadNote ||
          (mine ? (
            <Sleeve dark>
              <p className="font-serif text-xl font-bold">{mine === "skip" ? "You chose to skip." : `You voted for ${name(mine)}.`}</p>
              <p className="opacity-70">Waiting for everyone else…</p>
            </Sleeve>
          ) : (
            <Sleeve title="Who should leave town?">
              <div className="grid gap-2">
                {state.alive
                  .filter((id) => id !== me)
                  .map((id) => (
                    <Button key={id} variant="ghost" onClick={() => act({ type: "vote", id: me, target: id })}>
                      {name(id)}
                    </Button>
                  ))}
                <Button variant="secondary" onClick={() => act({ type: "vote", id: me, target: "skip" })}>
                  Skip
                </Button>
              </div>
            </Sleeve>
          ))}
      </Screen>
    );
  }

  if (state.phase === "verdict") {
    const out = state.lynched?.id;
    return (
      <Screen title="The verdict" kicker={`Day ${state.day}`} actions={hostButton("Night falls", () => ({ type: "nightfall" }))}>
        <Sleeve dark>
          <p className="font-serif text-2xl font-black">{out ? `${name(out)} was voted out.` : "No one was voted out."}</p>
          {out && roleOf(out) && <p className="mt-1 opacity-80">They were {ROLE[roleOf(out)].name}.</p>}
        </Sleeve>
        {deadNote}
      </Screen>
    );
  }

  return (
    <Screen title={state.winner === "town" ? "The town wins!" : "The Mafia wins!"} kicker="Game over" actions={hostButton("Back to the lobby", () => ({ type: "next" }))}>
      <Sleeve title="Who was who">
        <ul className="space-y-1">
          {state.players
            .filter((p) => state.roles[p.id])
            .map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className={`truncate ${state.alive.includes(p.id) ? "" : "line-through opacity-60"}`}>{p.name}</span>
                <span className={`font-mono text-sm font-bold ${state.roles[p.id] === "mafia" ? "text-crimson" : ""}`}>{ROLE[state.roles[p.id]].name}</span>
              </li>
            ))}
        </ul>
      </Sleeve>
    </Screen>
  );
}
