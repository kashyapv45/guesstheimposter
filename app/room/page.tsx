"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { GameView, PlayerList } from "@/components/GameView";
import { CratePicker, Scoreboard, SettingsPanel } from "@/components/panels";
import { Button, Led, QR, Screen, Sleeve } from "@/components/ui";
import { newGame, reduce, viewFor, type Action, type GameState } from "@/lib/game";
import { closeRoom, HostNet } from "@/lib/net";
import { formatCode, newRoomCode, randomId } from "@/lib/roomCode";
import { clearSession, HOST_KEY, IDLE_MS, loadSession, saveSession } from "@/lib/session";
import { useWordDeck } from "@/lib/useWordDeck";

type Boot = { code: string; secret: string; hostId: string; name: string };

// Guests may only act for themselves; everything else is host-only.
function guestMayDo(token: string, a: Action) {
  return (a.type === "revealed" && a.id === token) || (a.type === "vote" && a.voter === token) || (a.type === "guess" && a.id === token);
}

function hostReducer(s: GameState, a: Action | { type: "load"; state: GameState }) {
  return a.type === "load" ? a.state : reduce(s, a);
}

export default function HostRoom() {
  const deck = useWordDeck();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [name, setName] = useState("");
  const [state, dispatch] = useReducer(hostReducer, undefined, () => newGame());
  const [helloTick, setHelloTick] = useState(0);
  const [cloud, setCloud] = useState<"pending" | "ok" | "offline" | "nostore">("pending");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const lastActive = useRef(0);
  const lastTouch = useRef(0);

  // Restore after an accidental refresh (same tab), unless the room sat idle for an hour.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of sessionStorage after hydration */
  useEffect(() => {
    const saved = loadSession<{ boot: Boot; state: GameState }>(HOST_KEY);
    if (saved?.boot) {
      setBoot(saved.boot);
      dispatch({ type: "load", state: { ...saved.state, players: saved.state.players.map((p) => ({ ...p, connected: p.id === saved.boot.hostId })) } });
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hostNet = useMemo(
    () =>
      boot &&
      new HostNet(boot.code, boot.secret, {
      hello: (token, guestName) => {
        dispatch({ type: "join", id: token, name: guestName });
        setHelloTick((t) => t + 1);
      },
      action: (token, a) => guestMayDo(token, a) && dispatch(a),
        leave: (token) => dispatch({ type: "connected", id: token, connected: false }),
      }),
    [boot],
  );

  useEffect(() => {
    if (!hostNet) return;
    hostNet.register().then((r) => {
      if (r === "taken") setError("That room code is taken. Go back and create a new room.");
      setCloud(r === "ok" ? "ok" : r === "nostore" ? "nostore" : "offline");
    });
    hostNet.startPolling();
    return () => hostNet.close();
  }, [hostNet]);

  // Push each guest their own redacted view, and save for refresh recovery. Any change counts as activity.
  useEffect(() => {
    if (!boot || expired) return;
    for (const p of state.players) if (p.id !== boot.hostId) hostNet?.send(p.id, { type: "state", ...viewFor(state, p.id) });
    saveSession(HOST_KEY, { boot, state });
    const now = Date.now();
    lastActive.current = now;
    if (hostNet && now - lastTouch.current > 5 * 60 * 1000) {
      lastTouch.current = now;
      void hostNet.register(); // keeps the server-side room alive while you play
    }
  }, [state, helloTick, boot, hostNet, expired]);

  // Close the room after 1 hour without activity, even if the tab stays open.
  useEffect(() => {
    if (!boot || !hostNet || expired) return;
    const t = setInterval(() => {
      if (Date.now() - lastActive.current < IDLE_MS) return;
      hostNet.close();
      closeRoom(boot.code, boot.secret);
      clearSession(HOST_KEY);
      setExpired(true);
    }, 30_000);
    return () => clearInterval(t);
  }, [boot, hostNet, expired]);

  const act = useCallback((a: Action) => dispatch(a), []);

  if (expired)
    return (
      <Screen
        title="Room closed"
        kicker="Local Wi-Fi"
        actions={
          <Button
            onClick={() => {
              dispatch({ type: "load", state: newGame(state.settings) });
              setBoot(null);
              setCloud("pending");
              setExpired(false);
            }}
          >
            Open a new room
          </Button>
        }
      >
        <Sleeve>
          <p>This room closed after 1 hour without any play. Open a new room and share the new code.</p>
        </Sleeve>
      </Screen>
    );

  if (!boot)
    return (
      <Screen
        title="Host a room"
        kicker="Local Wi-Fi"
        actions={
          <Button
            disabled={!name.trim()}
            onClick={() => {
              const b: Boot = { code: newRoomCode(), secret: randomId(24), hostId: randomId(), name: name.trim() };
              dispatch({ type: "join", id: b.hostId, name: b.name });
              setBoot(b);
            }}
          >
            Open the room
          </Button>
        }
      >
        <Link href="/" className="font-mono text-xs underline">← Back</Link>
        <Sleeve title="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Host name" aria-label="Your name" className="w-full rounded-lg border-2 border-edge bg-field px-3 py-3 text-lg" />
        </Sleeve>
        <Sleeve>
          <p className="text-sm">You host and play on this phone. Everyone joins from this same Wi-Fi or hotspot. Keep this tab open: the game lives on your device.</p>
        </Sleeve>
      </Screen>
    );

  if (state.phase !== "lobby") {
    const view = viewFor(state, boot.hostId); // host plays too, so it sees only its own secret
    return <GameView state={view.state} secret={view.secret} me={boot.hostId} isHost act={act} />;
  }

  const start = () => {
    const w = deck.draw(state.settings.categories);
    if (!w) return setError("Pick at least one category.");
    setError("");
    dispatch({ type: "start", secret: { word: w.word, category: w.category, categoryName: w.categoryName, decoy: deck.decoy(w) }, now: Date.now(), seed: (Math.random() * 2 ** 32) >>> 0 });
  };
  const ready = state.players.filter((p) => p.connected).length;

  return (
    <Screen
      title="Your room"
      kicker="Local Wi-Fi"
      actions={
        <>
          {error && <p className="text-sm text-crimson">{error}</p>}
          <Button disabled={ready < 3 || !state.settings.categories.length} onClick={start}>
            {ready < 3 ? `Need ${3 - ready} more player${ready === 2 ? "" : "s"}` : "Drop the needle"}
          </Button>
        </>
      }
    >
      <CodeSleeve code={boot.code} />
      <p className="flex items-center gap-2 text-sm">
        <Led color={cloud === "ok" ? "green" : "off"} />
        {cloud === "ok"
          ? "Room is live. Everyone joins from this same Wi-Fi or hotspot; the game runs directly over your network."
          : cloud === "nostore"
            ? "Rooms can't open yet: this site has no Redis store for the join handshake. In Vercel → your project → Storage, connect Upstash Redis, then redeploy."
            : cloud === "offline"
              ? "Can't reach the site to open the room. Check your connection and try again."
              : "Opening room…"}
      </p>
      <Sleeve title={`Players (${state.players.length})`}>
        <PlayerList state={state} showLinks />
      </Sleeve>
      {state.roundNo > 0 && <Scoreboard state={state} />}
      <SettingsPanel settings={state.settings} players={ready} onChange={(settings) => dispatch({ type: "settings", settings })} />
      <CratePicker deck={deck} selected={state.settings.categories} onChange={(categories) => dispatch({ type: "settings", settings: { categories } })} />
    </Screen>
  );
}

function CodeSleeve({ code }: { code: string }) {
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/join/${code}`;
  return (
    <Sleeve dark className="text-center">
      {flipped ? (
        <div className="space-y-2">
          <QR text={link} size={220} />
          <p className="font-mono text-xs uppercase">Scan with your phone camera to join</p>
        </div>
      ) : (
        <button
          className="w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {}
          }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-70">Cat. No.</p>
          <p className="font-mono text-4xl font-bold tracking-widest text-amber">{formatCode(code)}</p>
          <p className="mt-1 text-xs opacity-70">{copied ? "Join link copied" : "Tap to copy the join link"}</p>
        </button>
      )}
      <button onClick={() => setFlipped(!flipped)} className="mt-3 rounded-md border-2 border-edge/40 px-3 py-1 font-mono text-xs uppercase">
        {flipped ? "Show code" : "Flip sleeve: QR code"}
      </button>
    </Sleeve>
  );
}
