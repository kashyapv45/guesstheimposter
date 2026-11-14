"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { GameView, PlayerList } from "@/components/GameView";
import { CratePicker, Scoreboard, SettingsPanel } from "@/components/panels";
import { QrScanner } from "@/components/QrScanner";
import { Button, QR, Screen, Sleeve } from "@/components/ui";
import { MAX_PLAYERS, newGame, reduce, viewFor, type Action, type GameState } from "@/lib/game";
import { HostNet } from "@/lib/net";
import { formatCode, newRoomCode, randomId } from "@/lib/roomCode";
import { clearSession, HOST_KEY, IDLE_MS, loadSession, saveSession } from "@/lib/session";
import { useWordDeck } from "@/lib/useWordDeck";

type Boot = { code: string; hostId: string; name: string };

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
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [repair, setRepair] = useState(false);
  const lastActive = useRef(0);

  // Restore after an accidental refresh (same tab), unless the room sat idle for an hour.
  // Guests' links don't survive a refresh, so they show as dropped and get re-paired.
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
      new HostNet({
        hello: (token, guestName) => {
          dispatch({ type: "join", id: token, name: guestName });
          setHelloTick((t) => t + 1);
        },
        action: (token, a) => guestMayDo(token, a) && dispatch(a),
        leave: (token) => dispatch({ type: "connected", id: token, connected: false }),
      }),
    [boot],
  );

  useEffect(() => () => hostNet?.close(), [hostNet]);

  // Push each guest their own redacted view, and save for refresh recovery. Any change counts as activity.
  useEffect(() => {
    if (!boot || expired) return;
    for (const p of state.players) if (p.id !== boot.hostId) hostNet?.send(p.id, { type: "state", ...viewFor(state, p.id) });
    saveSession(HOST_KEY, { boot, state });
    lastActive.current = Date.now();
  }, [state, helloTick, boot, hostNet, expired]);

  // Close the room after 1 hour without activity, even if the tab stays open.
  useEffect(() => {
    if (!boot || !hostNet || expired) return;
    const t = setInterval(() => {
      if (Date.now() - lastActive.current < IDLE_MS) return;
      hostNet.close();
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
              setExpired(false);
            }}
          >
            Open a new room
          </Button>
        }
      >
        <Sleeve>
          <p>This room closed after 1 hour without any play. Open a new room and invite everyone again.</p>
        </Sleeve>
      </Screen>
    );

  if (!boot || !hostNet)
    return (
      <Screen
        title="Host a room"
        kicker="Local Wi-Fi"
        actions={
          <Button
            disabled={!name.trim()}
            onClick={() => {
              const b: Boot = { code: newRoomCode(), hostId: randomId(), name: name.trim() };
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
          <p className="text-sm">You host and play on this phone. Everyone joins from this same Wi-Fi or hotspot by scanning your invite QR. Keep this tab open: the game lives on your device.</p>
        </Sleeve>
      </Screen>
    );

  const dropped = state.players.filter((p) => !p.connected);
  const full = state.players.filter((p) => p.connected).length >= MAX_PLAYERS && !dropped.length;

  if (state.phase !== "lobby") {
    const view = viewFor(state, boot.hostId); // host plays too, so it sees only its own secret
    return (
      <>
        {dropped.length > 0 && (
          <button onClick={() => setRepair(true)} className="sticky top-0 z-40 w-full bg-amber py-2 font-mono text-xs font-bold uppercase text-chassis">
            {dropped.map((p) => p.name).join(", ")} dropped · Tap to re-pair
          </button>
        )}
        {repair ? (
          <Screen title="Re-pair a player" kicker="Local Wi-Fi" actions={<Button variant="secondary" onClick={() => setRepair(false)}>Back to the game</Button>}>
            <p className="text-sm">They keep their seat and role. Have them scan this new invite with the same phone.</p>
            <InvitePanel net={hostNet} code={boot.code} full={false} />
          </Screen>
        ) : (
          <GameView state={view.state} secret={view.secret} me={boot.hostId} isHost act={act} />
        )}
      </>
    );
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
      <Sleeve dark className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-70">Cat. No.</p>
        <p className="font-mono text-4xl font-bold tracking-widest text-amber [text-shadow:0_0_10px_rgba(245,158,11,.5)]">{formatCode(boot.code)}</p>
      </Sleeve>
      <InvitePanel net={hostNet} code={boot.code} full={full} />
      <Sleeve title={`Players (${state.players.length} / ${MAX_PLAYERS})`}>
        <PlayerList state={state} showLinks />
      </Sleeve>
      {state.roundNo > 0 && <Scoreboard state={state} />}
      <SettingsPanel settings={state.settings} players={ready} onChange={(settings) => dispatch({ type: "settings", settings })} />
      <CratePicker deck={deck} selected={state.settings.categories} onChange={(categories) => dispatch({ type: "settings", settings: { categories } })} />
    </Screen>
  );
}

// One guest at a time: host's invite QR -> guest's reply QR -> host scans it.
function InvitePanel({ net, code, full }: { net: HostNet; code: string; full: boolean }) {
  const [invite, setInvite] = useState<{ pc: RTCPeerConnection; link: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cancel = () => {
    invite?.pc.close();
    setInvite(null);
    setScanning(false);
  };

  if (full)
    return (
      <Sleeve title="Invite players">
        <p className="text-sm">The room is full ({MAX_PLAYERS} players).</p>
      </Sleeve>
    );

  if (!invite)
    return (
      <Sleeve title="Invite players">
        <p className="mb-3 text-sm">Everyone must be on this same Wi-Fi or hotspot. Invite one player at a time.</p>
        {msg && <p className={`mb-3 text-sm ${msg.ok ? "text-emerald" : "text-crimson"}`}>{msg.text}</p>}
        <Button
          variant="teal"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const { pc, packed } = await net.createInvite();
            setInvite({ pc, link: `${location.origin}/join/${code}#o=${packed}` });
            setBusy(false);
          }}
        >
          {busy ? "Preparing invite…" : "Invite a player"}
        </Button>
      </Sleeve>
    );

  if (scanning)
    return (
      <Sleeve title="Step 2 · Scan their reply">
        <QrScanner
          onResult={async (text) => {
            try {
              await net.acceptReply(invite.pc, text);
              setMsg({ ok: true, text: "Paired! They'll appear in the player list in a moment. Invite the next player." });
              setInvite(null);
            } catch (e) {
              setMsg({ ok: false, text: e instanceof Error && e.message.startsWith("That") ? e.message : "That reply is from an old invite. Make a new invite." });
              cancel();
            }
            setScanning(false);
          }}
        />
        <button onClick={() => setScanning(false)} className="mt-2 w-full font-mono text-xs underline">
          Back to the invite QR
        </button>
      </Sleeve>
    );

  return (
    <Sleeve title="Step 1 · Let them scan this">
      <p className="mb-3 text-sm">They scan it with their phone camera, enter their name, then show you a reply QR.</p>
      <QR text={invite.link} size={260} />
      <div className="mt-3 space-y-2">
        <Button onClick={() => setScanning(true)}>Scan their reply</Button>
        <button onClick={cancel} className="w-full font-mono text-xs underline">
          Cancel invite
        </button>
      </div>
    </Sleeve>
  );
}
