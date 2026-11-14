"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameView } from "@/components/GameView";
import { Button, Screen, Sleeve, Vinyl } from "@/components/ui";
import type { GameState, Secret } from "@/lib/game";
import { GuestNet, type GuestStatus } from "@/lib/net";
import { cleanCode, formatCode, isValidCode, randomId } from "@/lib/roomCode";
import { guestKey, loadSession, saveSession } from "@/lib/session";

type Saved = { token: string; name: string };
// Our seat in a room, forgotten after 1 hour without activity.
const savedFor = (code: string) => loadSession<Saved>(guestKey(code));

export default function JoinClient() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<GuestStatus>("idle");
  const [view, setView] = useState<{ state: GameState; secret: Secret | null } | null>(null);
  const [me, setMe] = useState(""); // session token: survives refresh, so the host keeps our seat
  const net = useRef<GuestNet | null>(null);

  const connect = (c: string, n: string) => {
    const token = savedFor(c)?.token ?? randomId();
    setMe(token);
    saveSession<Saved>(guestKey(c), { token, name: n });
    if (location.pathname !== `/join/${c}`) history.replaceState(null, "", `/join/${c}`);
    net.current?.close();
    const g = new GuestNet(c, token, n, {
      message: (m) => setView({ state: m.state, secret: m.secret }),
      status: setStatus,
    });
    net.current = g;
    void g.connect();
  };

  // Code comes from the URL; a saved name means we rejoin after a refresh.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of URL + sessionStorage after hydration */
  useEffect(() => {
    const c = cleanCode(location.pathname.split("/")[2] ?? "");
    setCode(c);
    const saved = savedFor(c);
    if (saved?.name) {
      setName(saved.name);
      if (isValidCode(c)) connect(c, saved.name);
    }
    return () => net.current?.close();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (view && status !== "missing" && status !== "nostore" && status !== "lanfail")
    return (
      <>
        {status === "reconnecting" && <p className="sticky top-0 z-10 bg-amber py-1 text-center font-mono text-xs uppercase text-chassis">Reconnecting…</p>}
        <GameView state={view.state} secret={view.secret} me={me} isHost={false} act={(a) => {
            net.current?.send(a);
            saveSession<Saved>(guestKey(code), { token: me, name }); // activity keeps the seat
          }} />
      </>
    );

  if (status === "idle" || status === "missing" || status === "nostore" || status === "lanfail") {
    const valid = isValidCode(code);
    const problem =
      status === "missing"
        ? "No room with that code. Check it with your host. Rooms close after 1 hour without play."
        : status === "lanfail"
          ? "Couldn't reach the host's phone. Connect to the same Wi-Fi or hotspot as the host (not mobile data or a guest network), then try again."
          : status === "nostore"
          ? "Rooms can't open yet: this site has no Redis store for the join handshake. Connect Upstash Redis in Vercel and redeploy."
          : null;
    return (
      <Screen
        title={status === "idle" ? "Join a room" : status === "missing" ? "Room not found" : status === "lanfail" ? "Not on the host's Wi-Fi" : "Couldn't connect"}
        kicker={valid ? `Cat. No. ${formatCode(code)}` : "Enter the code"}
        actions={
          <Button
            disabled={!valid || !name.trim()}
            onClick={() => connect(code, name.trim())}
          >
            {status === "idle" ? "Join" : "Try again"}
          </Button>
        }
      >
        {problem && (
          <Sleeve>
            <p className="text-crimson">{problem}</p>
          </Sleeve>
        )}
        <Sleeve title="Room code">
          <input
            value={formatCode(code)}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="VNL7-K92P"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-lg border-2 border-edge bg-field px-3 py-3 font-mono text-2xl uppercase tracking-widest"
          />
          {code.length === 8 && !valid && <p className="mt-2 text-sm text-crimson">Codes never use 0, O, 1, I or L.</p>}
        </Sleeve>
        <Sleeve title="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" aria-label="Your name" className="w-full rounded-lg border-2 border-edge bg-field px-3 py-3 text-lg" />
        </Sleeve>
        <Link href="/" className="font-mono text-xs underline">← Home</Link>
      </Screen>
    );
  }

  return (
    <Screen title="Dropping the needle…" kicker={`Cat. No. ${formatCode(code)}`}>
      <div className="flex justify-center py-6">
        <Vinyl size={200} />
      </div>
      <p className="text-center font-mono text-sm uppercase tracking-widest">{status === "reconnecting" ? "Reconnecting to the host…" : "Connecting to the host…"}</p>
    </Screen>
  );
}
