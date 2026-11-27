"use client";
// Mafia screens for every phase. The app is the moderator; each phone only knows what its player may know.
import type { MAction, MRole, MState } from "@/lib/mafia";
import { hapticConfirm } from "@/lib/haptics";
import { HostBatchVote, PlayerList, PreliminaryResults } from "./GameView";
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
  const isNarrator = state.narrator === me;
  const alive = state.alive.includes(me);
  const color = state.players.find((p) => p.id === me)?.color ?? "var(--amber)";
  const team = Object.keys(state.roles).filter((id) => id !== me && state.roles[id] === "mafia");
  // Actions are built at tap time (e.g. the day timer's start time), not while rendering.
  const hostButton = (label: string, a: () => MAction) => isHost && <Button onClick={() => act(a())}>{label}</Button>;
  const castList = (
    <Sleeve title="Cast & roles (Narrator)">
      <ul className="space-y-1.5 text-sm">
        {state.players
          .filter((p) => state.roles[p.id])
          .map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className={`truncate font-bold ${state.alive.includes(p.id) ? "" : "line-through opacity-50"}`}>{p.name}</span>
              <span className={`font-mono text-xs font-bold uppercase ${state.roles[p.id] === "mafia" ? "text-crimson" : "opacity-80"}`}>
                {ROLE[state.roles[p.id]].name}
              </span>
            </li>
          ))}
      </ul>
    </Sleeve>
  );
  const deadNote = !alive && myRole && state.phase !== "lobby" && (
    <Sleeve dark>
      <p className="font-serif text-xl font-bold">You&apos;re out.</p>
      <p className="opacity-70">Stay quiet and watch the rest unfold.</p>
    </Sleeve>
  );

  if (state.phase === "lobby" || (!myRole && !isNarrator))
    return (
      <Screen title="Mafia" kicker={state.phase === "lobby" ? "Waiting room" : "Game in progress"}>
        <Sleeve title={`Players (${state.players.length})`}>
          <PlayerList
            players={state.players}
            me={me}
            canRename={(id) => id === me}
            onRename={state.phase === "lobby" && state.settings.allowRename !== false ? (id, newName) => act({ type: "rename", id, name: newName }) : undefined}
          />
        </Sleeve>
        <p className="text-center font-mono text-sm uppercase tracking-widest">
          {state.phase === "lobby" ? "Waiting for the host to deal the roles…" : "This game started before you joined. You'll play the next one."}
        </p>
      </Screen>
    );

  if (isNarrator && state.phase !== "over") {
    if (state.phase === "reveal")
      return (
        <Screen
          title="Narrator · Deal"
          kicker={`${state.revealed.length} / ${state.alive.length} have looked`}
          actions={hostButton(state.revealed.length < state.alive.length ? "Night falls anyway" : "Night falls", () => ({ type: "nightfall" }))}
        >
          <Sleeve dark>
            <p className="font-serif text-xl font-bold">You are the Narrator.</p>
            <p className="text-sm opacity-80">Have every contestant check their role, then start Night 1.</p>
          </Sleeve>
          {castList}
        </Screen>
      );

    if (state.phase === "night") {
      const mafiaActor = state.alive.find((id) => roleOf(id) === "mafia");
      const doctorActor = state.alive.find((id) => roleOf(id) === "doctor");
      const detectiveActor = state.alive.find((id) => roleOf(id) === "detective");
      const mafiaPick = (mafiaActor && state.night.picks[mafiaActor]) ?? "";
      const doctorPick = (doctorActor && state.night.picks[doctorActor]) ?? "";
      const detectivePick = (detectiveActor && state.night.picks[detectiveActor]) ?? "";
      return (
        <Screen
          title={`Narrator · Night ${state.day + 1}`}
          kicker={`${state.night.done.length} / ${state.alive.length} ready`}
          actions={isHost && <Button onClick={() => act({ type: "force" })}>Resolve night</Button>}
        >
          <Sleeve dark>
            <p className="font-serif text-xl font-bold">Everyone close your eyes.</p>
            <p className="text-sm opacity-80">Select or monitor Mafia kill, Doctor save, and Detective suspect in real time.</p>
          </Sleeve>
          <Sleeve title="Night selections (Host)">
            <div className="space-y-3 text-sm">
              {mafiaActor && (
                <label className="flex flex-col gap-1">
                  <span className="font-bold text-crimson">Mafia · Who to kill?</span>
                  <select
                    aria-label="Mafia kill target"
                    value={mafiaPick}
                    onChange={(e) => act({ type: "nightPick", role: "mafia", target: e.target.value || null })}
                    className="rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-3 py-2 font-bold text-ink"
                  >
                    <option value="">No one selected…</option>
                    {state.alive
                      .filter((id) => roleOf(id) !== "mafia")
                      .map((id) => (
                        <option key={id} value={id}>
                          {name(id)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {doctorActor && (
                <label className="flex flex-col gap-1">
                  <span className="font-bold">Doctor · Who to save? (can save self)</span>
                  <select
                    aria-label="Doctor save target"
                    value={doctorPick}
                    onChange={(e) => act({ type: "nightPick", role: "doctor", target: e.target.value || null })}
                    className="rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-3 py-2 font-bold text-ink"
                  >
                    <option value="">No one selected…</option>
                    {state.alive.map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                        {id === doctorActor ? " (Doctor · self)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {detectiveActor && (
                <div className="space-y-1">
                  <label className="flex flex-col gap-1">
                    <span className="font-bold">Detective · Who to suspect?</span>
                    <select
                      aria-label="Detective suspect target"
                      value={detectivePick}
                      onChange={(e) => act({ type: "nightPick", role: "detective", target: e.target.value || null })}
                      className="rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-3 py-2 font-bold text-ink"
                    >
                      <option value="">No one selected…</option>
                      {state.alive
                        .filter((id) => id !== detectiveActor)
                        .map((id) => (
                          <option key={id} value={id}>
                            {name(id)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {detectivePick && (
                    <p className="font-mono text-xs font-bold">
                      Result: {name(detectivePick)} is{" "}
                      {roleOf(detectivePick) === "mafia" ? <span className="text-crimson">MAFIA</span> : "NOT Mafia"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Sleeve>
          <Sleeve title="Realtime player status">
            <ul className="space-y-1.5 text-sm">
              {state.alive.map((id) => {
                const done = state.night.done.includes(id);
                const pick = state.night.picks[id];
                return (
                  <li key={id} className="flex justify-between gap-2">
                    <span className="truncate font-bold">{name(id)} ({ROLE[roleOf(id)].name})</span>
                    <span className="font-mono text-xs opacity-80">{done ? (pick ? `→ ${name(pick)}` : "asleep") : "waiting…"}</span>
                  </li>
                );
              })}
            </ul>
          </Sleeve>
          {castList}
        </Screen>
      );
    }

    if (state.phase === "morning") {
      const r = state.report;
      const died = r?.died;
      const savedVictim = !!r?.mafiaTarget && r.doctorTarget === r.mafiaTarget;
      return (
        <Screen title={`Narrator · Day ${state.day}`} kicker="Morning" actions={isHost && <Button onClick={() => act({ type: "discuss", now: Date.now() })}>Start the discussion</Button>}>
          <Sleeve dark>
            <p className="font-serif text-2xl font-black">{died ? `${name(died)} was eliminated in the night.` : "Nobody died last night."}</p>
            <p className="mt-1 text-sm opacity-80">Announce the morning news to the town.</p>
          </Sleeve>
          <Sleeve title="End of round details (Host)">
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between gap-2">
                <span className="opacity-75">Mafia targeted</span>
                <span className="font-bold text-crimson">{r?.mafiaTarget ? name(r.mafiaTarget) : "Nobody"}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="opacity-75">Doctor saved</span>
                <span className="font-bold">
                  {r?.doctorTarget ? `${name(r.doctorTarget)}${savedVictim ? " (blocked kill!)" : ""}` : "Nobody"}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="opacity-75">Detective suspected</span>
                <span className="font-bold">
                  {r?.detectiveTarget ? `${name(r.detectiveTarget)} (${r.detectiveMafia ? "Mafia" : "Not Mafia"})` : "Nobody"}
                </span>
              </li>
            </ul>
          </Sleeve>
          {castList}
        </Screen>
      );
    }

    if (state.phase === "day")
      return (
        <Screen
          title={`Narrator · Day ${state.day}`}
          kicker="Discussion"
          actions={
            isHost && (
              <>
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
          <Timer endAt={state.timerEnd} total={state.settings.daySeconds} caption="Guide the discussion" />
          {state.preliminaryVotes && <PreliminaryResults votes={state.preliminaryVotes} nameOf={name} />}
          {castList}
        </Screen>
      );

    if (state.phase === "preliminary")
      return (
        <Screen
          title="Narrator · Preliminary vote"
          kicker="For debate before final vote"
          actions={isHost && <Button variant="ghost" onClick={() => act({ type: "startVote" })}>Skip to final vote</Button>}
        >
          <HostBatchVote
            voters={state.alive}
            targets={state.alive}
            nameOf={name}
            allowSkip
            submitLabel="Show preliminary results"
            onSubmit={(votes) => act({ type: "batchPreliminaryVote", votes })}
          />
          {castList}
        </Screen>
      );

    if (state.phase === "vote")
      return (
        <Screen title="Narrator · Town vote" kicker={`Day ${state.day}`}>
          <HostBatchVote
            voters={state.alive}
            targets={state.alive}
            nameOf={name}
            allowSkip
            initialVotes={state.preliminaryVotes ?? undefined}
            submitLabel="Submit all votes"
            onSubmit={(votes) => act({ type: "batchVote", votes })}
          />
          {castList}
        </Screen>
      );

    if (state.phase === "verdict") {
      const out = state.lynched?.id;
      return (
        <Screen title="Narrator · Verdict" kicker={`Day ${state.day}`} actions={hostButton("Night falls", () => ({ type: "nightfall" }))}>
          <Sleeve dark>
            <p className="font-serif text-2xl font-black">{out ? `${name(out)} was voted out.` : "No one was voted out."}</p>
            <p className="mt-1 text-sm opacity-80">Announce the verdict, then send the town back to sleep.</p>
          </Sleeve>
          {castList}
        </Screen>
      );
    }
  }

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
                  <Button
                    key={id}
                    variant="ghost"
                    onClick={() => {
                      hapticConfirm();
                      act({ type: "night", id: me, target: id });
                    }}
                  >
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
              <Button
                variant="secondary"
                onClick={() => {
                  hapticConfirm();
                  act({ type: "night", id: me, target: null });
                }}
              >
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
      <Screen
        title={`Day ${state.day}`}
        kicker="Discussion"
        actions={
          isHost && (
            <>
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
        <Timer endAt={state.timerEnd} total={state.settings.daySeconds} caption="Talk it out" />
        {state.preliminaryVotes && <PreliminaryResults votes={state.preliminaryVotes} nameOf={name} />}
        <Sleeve title={`Still in (${state.alive.length})`}>
          <PlayerList players={state.players.filter((p) => state.alive.includes(p.id))} me={me} />
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

  if (state.phase === "preliminary")
    return (
      <Screen
        title="Preliminary vote"
        kicker="For debate before final vote"
        actions={isHost && <Button variant="ghost" onClick={() => act({ type: "startVote" })}>Skip to final vote</Button>}
      >
        {isHost ? (
          <HostBatchVote
            voters={state.alive}
            targets={state.alive}
            nameOf={name}
            allowSkip
            submitLabel="Show preliminary results"
            onSubmit={(votes) => act({ type: "batchPreliminaryVote", votes })}
          />
        ) : (
          <Sleeve dark>
            <p className="font-serif text-xl font-bold">Preliminary vote in progress.</p>
            <p className="opacity-70">Tell the host who you suspect — the host is entering everyone&apos;s votes.</p>
          </Sleeve>
        )}
        {deadNote}
      </Screen>
    );

  if (state.phase === "vote") {
    return (
      <Screen title="Town vote" kicker={`Day ${state.day}`}>
        {isHost ? (
          <HostBatchVote
            voters={state.alive}
            targets={state.alive}
            nameOf={name}
            allowSkip
            initialVotes={state.preliminaryVotes ?? undefined}
            submitLabel="Submit all votes"
            onSubmit={(votes) => act({ type: "batchVote", votes })}
          />
        ) : (
          <Sleeve dark>
            <p className="font-serif text-xl font-bold">Final vote in progress.</p>
            <p className="opacity-70">Waiting for the host to enter everyone&apos;s votes…</p>
          </Sleeve>
        )}
        {deadNote}
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
                <span className={`truncate ${state.alive.includes(p.id) ? "" : "line-through opacity-60"}`}>
                  {p.name}
                  {p.id === me && " (you)"}
                </span>
                <span className={`font-mono text-sm font-bold ${state.roles[p.id] === "mafia" ? "text-crimson" : ""}`}>{ROLE[state.roles[p.id]].name}</span>
              </li>
            ))}
        </ul>
      </Sleeve>
    </Screen>
  );
}
