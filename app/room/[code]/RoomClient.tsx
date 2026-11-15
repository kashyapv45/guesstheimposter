"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameView } from "@/components/GameView";
import { ImposterLobby, MafiaLobby } from "@/components/lobbies";
import { MafiaView } from "@/components/MafiaView";
import { Button, Screen, Sleeve } from "@/components/ui";
import type { Action, GameState } from "@/lib/game";
import type { MAction, MState } from "@/lib/mafia";
import { cleanCode, formatCode, isValidCode, newRoomCode, randomId } from "@/lib/roomCode";
import { guestKey, loadSession, saveSession } from "@/lib/session";
import { useRoom, type Game } from "@/lib/useRoom";

type Saved = { token: string; name: string };

export default function RoomClient() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [create, setCreate] = useState<Game | undefined>();
  const [me, setMe] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  // Seat (token + name) lives in this tab for 1 hour without play, so a refresh rejoins automatically.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of URL + sessionStorage after hydration */
  useEffect(() => {
    const c = cleanCode(location.pathname.split("/")[2] ?? "");
    const g = new URLSearchParams(location.search).get("create");
    setCode(c);
    setCreate(g === "imposter" || g === "mafia" ? g : undefined);
    const saved = loadSession<Saved>(guestKey(c));
    setMe(saved?.token ?? randomId());
    if (saved?.name) {
      setName(saved.name);
      setJoined(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { msg, status, act } = useRoom(code, joined ? me : "", joined ? name : "", create);
  const send = (a: Action | MAction) => {
    act(a);
    saveSession<Saved>(guestKey(code), { token: me, name }); // activity keeps the seat
  };

  // Someone else already owns this code (very unlikely): make a fresh one.
  useEffect(() => {
    if (status === "taken" && create) router.replace(`/room/${newRoomCode()}?create=${create}`);
  }, [status, create, router]);

  if (!joined)
    return (
      <Screen
        title={create ? `Host ${create === "mafia" ? "Mafia" : "Guess the Imposter"}` : "Join a room"}
        kicker={isValidCode(code) ? `Room ${formatCode(code)}` : "Room code"}
        actions={
          <Button
            disabled={!isValidCode(code) || !name.trim()}
            onClick={() => {
              saveSession<Saved>(guestKey(code), { token: me, name: name.trim() });
              setName(name.trim());
              setJoined(true);
            }}
          >
            {create ? "Open the room" : "Join"}
          </Button>
        }
      >
        {!create && (
          <Sleeve title="Room code">
            <input
              value={formatCode(code)}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              placeholder="VNL7-K92P"
              aria-label="Room code"
              autoCapitalize="characters"
              autoComplete="off"
              className="w-full rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-3 py-3 font-mono text-2xl uppercase tracking-widest"
            />
          </Sleeve>
        )}
        <Sleeve title="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" aria-label="Your name" className="w-full rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-3 py-3 text-lg" />
        </Sleeve>
        <Link href="/" className="font-mono text-xs underline">← Party Kit</Link>
      </Screen>
    );

  if (status === "nosetup" || status === "missing")
    return (
      <Screen title={status === "missing" ? "Room not found" : "Online play isn't set up"} kicker={`Room ${formatCode(code)}`}>
        <Sleeve>
          <p>
            {status === "missing"
              ? "No room with that code is open. Check the code with your host; rooms close when everyone leaves."
              : "This site isn't connected to its PartyKit room server yet (NEXT_PUBLIC_PARTYKIT_HOST is missing)."}
          </p>
        </Sleeve>
        <Link href="/" className="font-mono text-xs underline">← Party Kit</Link>
      </Screen>
    );

  if (!msg)
    return (
      <Screen title="Connecting…" kicker={`Room ${formatCode(code)}`}>
        <p className="py-10 text-center font-mono text-sm uppercase tracking-widest">{status === "offline" ? "Reconnecting to the room…" : "Opening the room…"}</p>
      </Screen>
    );

  const isHost = msg.host === me;
  const banner = status === "offline" && <p className="sticky top-0 z-40 bg-amber py-1 text-center font-mono text-xs uppercase text-on-accent">Reconnecting…</p>;

  if (msg.game === "mafia") {
    const state = msg.state as MState;
    return (
      <>
        {banner}
        {state.phase === "lobby" && isHost ? <MafiaLobby code={code} state={state} act={send} /> : <MafiaView state={state} me={me} isHost={isHost} act={send} />}
      </>
    );
  }
  const state = msg.state as GameState;
  return (
    <>
      {banner}
      {state.phase === "lobby" && isHost ? <ImposterLobby code={code} state={state} act={send} /> : <GameView state={state} secret={msg.secret} me={me} isHost={isHost} act={send} />}
    </>
  );
}
