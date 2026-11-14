"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { GameView, PlayerList } from "@/components/GameView";
import { CratePicker, Scoreboard, SettingsPanel } from "@/components/panels";
import { QrScanner } from "@/components/QrScanner";
import { Button, CopyText, Led, QR, Screen, Sleeve } from "@/components/ui";
import { newGame, reduce, viewFor, type Action, type GameState } from "@/lib/game";
import { HostNet } from "@/lib/net";
import { formatCode, newRoomCode, randomId } from "@/lib/roomCode";
import { useWordDeck } from "@/lib/useWordDeck";

type Boot = { code: string; secret: string; hostId: string; mode: "online" | "lan"; name: string };
const SAVE_KEY = "imposter:host";

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
  const [mode, setMode] = useState<"online" | "lan">("online");
  const [name, setName] = useState("");
  const [state, dispatch] = useReducer(hostReducer, undefined, () => newGame());
  const [helloTick, setHelloTick] = useState(0);
  const [cloud, setCloud] = useState<"pending" | "ok" | "offline">("pending");
  const [links, setLinks] = useState<Record<string, "lan" | "cloud">>({});
  const [error, setError] = useState("");

  // Restore after an accidental refresh (same tab): same code, same players, same round.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of URL + sessionStorage after hydration */
  useEffect(() => {
    const m = new URLSearchParams(location.search).get("mode");
    if (m === "lan") setMode("lan");
    try {
      const saved = JSON.parse(sessionStorage.getItem(SAVE_KEY) ?? "null") as { boot: Boot; state: GameState } | null;
      if (saved?.boot) {
        setBoot(saved.boot);
        dispatch({ type: "load", state: { ...saved.state, players: saved.state.players.map((p) => ({ ...p, connected: p.id === saved.boot.hostId })) } });
      }
    } catch {}
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
      setCloud(r === "ok" ? "ok" : "offline");
    });
    hostNet.startPolling();
    return () => hostNet.close();
  }, [hostNet]);

  // Push each guest their own redacted view, and save for refresh recovery.
  useEffect(() => {
    if (!boot) return;
    for (const p of state.players) if (p.id !== boot.hostId) hostNet?.send(p.id, { type: "state", ...viewFor(state, p.id) });
    try {
      sessionStorage.setItem(SAVE_KEY, JSON.stringify({ boot, state }));
    } catch {}
  }, [state, helloTick, boot, hostNet]);

  // Connection LEDs: green = direct over the local network, amber = through the internet.
  useEffect(() => {
    if (!boot || !hostNet) return;
    const check = async () => {
      const n = hostNet;
      const out: Record<string, "lan" | "cloud"> = {};
      for (const p of state.players) if (p.id !== boot.hostId && p.connected) out[p.id] = (await n.lanStatus(p.id)) ? "lan" : "cloud";
      setLinks(out);
    };
    void check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [boot, hostNet, state.players]);

  const act = useCallback((a: Action) => dispatch(a), []);

  if (!boot)
    return (
      <Screen
        title="Host a room"
        kicker={mode === "lan" ? "Local Wi-Fi" : "Online"}
        actions={
          <Button
            disabled={!name.trim()}
            onClick={() => {
              const b: Boot = { code: newRoomCode(), secret: randomId(24), hostId: randomId(), mode, name: name.trim() };
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
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Host name" aria-label="Your name" className="w-full rounded-lg border-2 border-charcoal bg-cream px-3 py-3 text-lg" />
        </Sleeve>
        <Sleeve>
          <p className="text-sm">You host and play on this phone. Keep this tab open: the game lives on your device.</p>
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
      kicker={boot.mode === "lan" ? "Local Wi-Fi" : "Online"}
      actions={
        <>
          {error && <p className="text-sm text-orange">{error}</p>}
          <Button disabled={ready < 3 || !state.settings.categories.length} onClick={start}>
            {ready < 3 ? `Need ${3 - ready} more player${ready === 2 ? "" : "s"}` : "Drop the needle"}
          </Button>
        </>
      }
    >
      <CodeSleeve code={boot.code} />
      <p className="flex items-center gap-2 text-sm">
        <Led color={cloud === "ok" ? "amber" : cloud === "offline" ? "off" : "off"} />
        {cloud === "ok" ? "Room is live. Friends can join with the code." : cloud === "offline" ? "No internet handshake available. Use the offline QR invite below." : "Opening room…"}
      </p>
      <Sleeve title={`Players (${state.players.length})`}>
        <PlayerList state={state} links={links} />
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs">
          <span className="flex items-center gap-1"><Led color="green" /> same Wi-Fi, direct</span>
          <span className="flex items-center gap-1"><Led color="amber" /> via internet</span>
        </p>
      </Sleeve>
      {(boot.mode === "lan" || cloud === "offline") && hostNet && <OfflineInvite net={hostNet} code={boot.code} />}
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
          <p className="font-mono text-4xl font-bold tracking-widest text-mustard">{formatCode(code)}</p>
          <p className="mt-1 text-xs opacity-70">{copied ? "Join link copied" : "Tap to copy the join link"}</p>
        </button>
      )}
      <button onClick={() => setFlipped(!flipped)} className="mt-3 rounded-md border-2 border-cream/40 px-3 py-1 font-mono text-xs uppercase">
        {flipped ? "Show code" : "Flip sleeve: QR code"}
      </button>
    </Sleeve>
  );
}

// No-internet handshake: host QR (offer) -> guest camera opens link -> guest QR (answer) -> host scans.
function OfflineInvite({ net, code }: { net: HostNet; code: string }) {
  const [invite, setInvite] = useState<{ pc: RTCPeerConnection; packed: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const link = invite ? `${location.origin}/join/${code}#o=${invite.packed}` : "";
  return (
    <Sleeve title="Offline invite (no internet)">
      {!invite ? (
        <>
          <p className="mb-3 text-sm">Everyone on the same Wi-Fi or hotspot, no internet needed. Invite one phone at a time.</p>
          {msg && <p className="mb-2 text-sm text-teal">{msg}</p>}
          <Button variant="teal" onClick={async () => (setMsg(""), setInvite(await net.createInvite()))}>
            Create invite QR
          </Button>
        </>
      ) : scanning ? (
        <>
          <p className="mb-2 text-sm font-bold">Scan the reply QR on your friend&apos;s phone</p>
          <QrScanner
            onResult={async (text) => {
              try {
                await net.acceptInvite(invite.pc, text);
                setMsg("Connected! Make another invite for the next player.");
                setInvite(null);
                setScanning(false);
              } catch (e) {
                setMsg((e as Error).message);
                setScanning(false);
              }
            }}
          />
          <button onClick={() => setScanning(false)} className="mt-2 w-full font-mono text-xs underline">Back to invite QR</button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm"><b>1.</b> Friend scans this with their camera (the app must have been opened on their phone once before).</p>
          <QR text={link} size={260} />
          <CopyText text={link} label="Copy invite link" />
          {msg && <p className="text-sm text-orange">{msg}</p>}
          <p className="text-sm"><b>2.</b> Their phone shows a reply QR. Scan it:</p>
          <Button onClick={() => setScanning(true)}>Scan their reply</Button>
        </div>
      )}
    </Sleeve>
  );
}
