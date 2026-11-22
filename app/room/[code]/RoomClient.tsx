"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GameView } from "@/components/GameView";
import { ImposterLobby, MafiaLobby } from "@/components/lobbies";
import { MafiaView } from "@/components/MafiaView";
import { Button, ConfirmSheet, Screen, Sleeve } from "@/components/ui";
import type { Action, GameState } from "@/lib/game";
import type { MAction, MState } from "@/lib/mafia";
import { cleanCode, formatCode, isValidCode, randomId } from "@/lib/roomCode";
import { guestKey, loadSession, saveSession } from "@/lib/session";
import { useBackGuard } from "@/lib/useBackGuard";
import { useGuestRoom, useHostRoom, type Game } from "@/lib/useRoom";

// Seat in this tab, kept for 1 hour without play. `host` marks the phone that runs the room.
type Saved = { token: string; name: string; host?: Game };
const GAME_NAME: Record<Game, string> = { imposter: "Guess the Imposter", mafia: "Mafia" };

export default function RoomClient() {
  const [code, setCode] = useState("");
  const [create, setCreate] = useState<Game | undefined>();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [hostGame, setHostGame] = useState<Game | undefined>();
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of URL + sessionStorage after hydration */
  useEffect(() => {
    const seg = location.pathname.split("/")[2] ?? "";
    const g = new URLSearchParams(location.search).get("create");
    if (seg === "new" && (g === "imposter" || g === "mafia")) {
      setCreate(g);
      setToken(randomId());
      return;
    }
    const c = cleanCode(seg);
    setCode(c);
    const saved = loadSession<Saved>(guestKey(c));
    setToken(saved?.token ?? randomId());
    if (saved?.name) {
      setName(saved.name);
      setHostGame(saved.host);
      setJoined(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hosting = joined && !!hostGame;
  const host = useHostRoom(hosting ? code : "", hosting ? token : "", name, hostGame ?? "imposter");
  const guest = useGuestRoom(joined && !hostGame ? code : "", joined && !hostGame ? token : "", name);
  const { msg, status, me, act } = hosting ? host : guest;
  const send = (a: Action | MAction) => {
    act(a);
    saveSession<Saved>(guestKey(code), { token, name, host: hostGame }); // activity keeps the seat
  };

  const open = async () => {
    const n = name.trim();
    if (create) {
      // The room code comes from the host's secret, so only this phone can run this room.
      const r = await fetch(`/api/ably?t=${token}&code=new`, { cache: "no-store" }).catch(() => null);
      if (!r || !r.ok) return setError(r?.status === 503 ? "nosetup" : "Couldn't reach the server. Check your connection.");
      const { code: c } = (await r.json()) as { code: string };
      saveSession<Saved>(guestKey(c), { token, name: n, host: create });
      history.replaceState(null, "", `/room/${c}`);
      setCode(c);
      setHostGame(create);
    } else saveSession<Saved>(guestKey(code), { token, name: n });
    setName(n);
    setJoined(true);
  };

  // Phone/browser back inside a room asks before leaving it.
  const [leaving, setLeaving] = useState(false);
  const leave = useBackGuard(joined && !!msg, () => setLeaving(true));

  const screen = (() => {
  if (error === "nosetup" || status === "nosetup")
    return (
      <Screen title="Online play isn't set up" kicker="Party Kit">
        <Sleeve>
          <p>This site has no Ably key yet. Add <b>ABLY_API_KEY</b> in Vercel → Settings → Environment Variables, then redeploy.</p>
        </Sleeve>
        <Link href="/" className="font-mono text-xs underline">← Party Kit</Link>
      </Screen>
    );

  if (!joined)
    return (
      <Screen
        title={create ? `Host ${GAME_NAME[create]}` : "Join a room"}
        kicker={create ? "New online room" : isValidCode(code) ? `Room ${formatCode(code)}` : "Room code"}
        actions={
          <>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <Button disabled={(!create && !isValidCode(code)) || !name.trim() || !token} onClick={open}>
              {create ? "Open the room" : "Join"}
            </Button>
          </>
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

  if (status === "missing")
    return (
      <Screen title="Room not found" kicker={`Room ${formatCode(code)}`}>
        <Sleeve>
          <p>Nobody is hosting this code right now. Check the code with your host, and make sure their room screen is open.</p>
        </Sleeve>
        <Link href="/" className="font-mono text-xs underline">← Party Kit</Link>
      </Screen>
    );

  if (!msg)
    return (
      <Screen title={status === "offline" ? "Reconnecting…" : "Connecting…"} kicker={`Room ${formatCode(code)}`}>
        <div className="py-10 text-center space-y-4">
          <p className="font-mono text-sm uppercase tracking-widest">
            {status === "waiting" ? "Waiting for the host…" : status === "offline" ? "Connection lost. Reconnecting…" : "Opening the room…"}
          </p>
          <Link href="/" className="font-mono text-xs underline opacity-70 hover:opacity-100">
            ← Party Kit
          </Link>
        </div>
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
  })();
  return (
    <>
      {screen}
      <ConfirmSheet
        open={leaving}
        title="Leave the room?"
        body={hosting ? "You're the host: leaving ends the room for everyone." : "You can rejoin with the same code."}
        confirmLabel="Leave"
        onConfirm={() => leave("/")}
        onCancel={() => setLeaving(false)}
      />
    </>
  );
}
