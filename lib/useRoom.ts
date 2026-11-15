"use client";
// Online rooms on Ably. The host's phone runs the game; Ably relays messages.
//   room:<CODE>:host      guests -> host (hello / action); presence shows who is connected
//   room:<CODE>:p:<pid>   host -> one player (their own redacted view)
// Ably authenticates every message's clientId (pid), so the host knows who sent what.
import * as Ably from "ably";
import { useCallback, useEffect, useRef, useState } from "react";
import { newGame, reduce as reduceImposter, viewFor, type Action as IAction, type GameState, type Secret } from "./game";
import { newMafia, reduceMafia, viewMafia, type MAction, type MState } from "./mafia";
import { loadSession, saveSession } from "./session";

export type Game = "imposter" | "mafia";
export type RoomMsg = { game: Game; host: string; state: unknown; secret: Secret | null };
export type RoomStatus = "connecting" | "open" | "waiting" | "missing" | "nosetup" | "offline";
type AnyAction = IAction | MAction;

const GUEST_ONLY: Record<Game, Set<string>> = { imposter: new Set(["revealed", "vote"]), mafia: new Set(["revealed", "night", "vote"]) };

function client(code: string, token: string, onId: (pid: string) => void, onNoSetup: () => void) {
  return new Ably.Realtime({
    authCallback: async (_params, cb) => {
      try {
        const r = await fetch(`/api/ably?t=${token}&code=${code}`, { cache: "no-store" });
        if (r.status === 503) {
          onNoSetup();
          return cb("nosetup", null);
        }
        const tr = (await r.json()) as Ably.TokenRequest;
        if (tr.clientId) onId(tr.clientId);
        cb(null, tr);
      } catch (e) {
        cb(String(e), null);
      }
    },
  });
}

const viewOf = (game: Game, s: GameState | MState, pid: string) =>
  game === "imposter" ? viewFor(s as GameState, pid) : { state: viewMafia(s as MState, pid), secret: null };

// ---------- host: runs the rules, sends each player their own view ----------
export function useHostRoom(code: string, token: string, name: string, game: Game) {
  const saveKey = `imposter:hoststate:${code}`;
  const [state, setState] = useState<GameState | MState | null>(null);
  const [me, setMe] = useState("");
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [tick, setTick] = useState(0); // forces a resend when a player says hello again
  const ably = useRef<Ably.Realtime | null>(null);

  const dispatch = useCallback(
    (a: AnyAction) => setState((s) => (s ? (game === "imposter" ? reduceImposter(s as GameState, a as IAction) : reduceMafia(s as MState, a as MAction)) : s)),
    [game],
  );

  useEffect(() => {
    if (!code || !token || !name) return;
    // Restore after a refresh (1 hour); players show as dropped until their phones say hello again.
    const saved = loadSession<GameState | MState>(saveKey);
    const restored = saved ? ({ ...saved, players: saved.players.map((p) => ({ ...p, connected: false })) } as GameState | MState) : null;
    const rt = client(code, token, setMe, () => setStatus("nosetup"));
    ably.current = rt;
    const inbox = rt.channels.get(`room:${code}:host`);
    rt.connection.on("connected", () => setStatus("open"));
    rt.connection.on("disconnected", () => setStatus("offline"));
    inbox.subscribe("hello", (m) => {
      if (!m.clientId) return;
      setState((s) => {
        if (!s) return s;
        const a = { type: "join", id: m.clientId!, name: String((m.data as { name?: unknown })?.name ?? "Player") } as AnyAction;
        return game === "imposter" ? reduceImposter(s as GameState, a as IAction) : reduceMafia(s as MState, a as MAction);
      });
      setTick((t) => t + 1);
    });
    inbox.subscribe("action", (m) => {
      const a = (m.data as { action?: AnyAction })?.action;
      if (!m.clientId || !a || typeof a !== "object") return;
      const x = a as { type: string; id?: string; voter?: string };
      if (!GUEST_ONLY[game].has(x.type) || (x.id ?? x.voter) !== m.clientId) return; // guests act only for themselves
      dispatch(a);
    });
    inbox.presence.subscribe("leave", (m) => m.clientId && dispatch({ type: "connected", id: m.clientId, connected: false } as AnyAction));
    void inbox.presence.enter({ host: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- room state is created when the connection is set up
    setState(restored ?? (game === "imposter" ? newGame() : newMafia()));
    return () => rt.close();
  }, [code, token, name, game, saveKey, dispatch]);

  // Host plays too.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seat the host once Ably tells us its id
    if (me) dispatch({ type: "join", id: me, name } as AnyAction);
  }, [me, name, dispatch]);

  // Send every other player their own view, and keep a copy for refresh recovery.
  useEffect(() => {
    const rt = ably.current;
    if (!state || !rt || !me) return;
    for (const p of state.players)
      if (p.id !== me && p.connected) void rt.channels.get(`room:${code}:p:${p.id}`).publish("state", { game, host: me, ...viewOf(game, state, p.id) });
    saveSession(saveKey, state);
  }, [state, tick, me, code, game, saveKey]);

  const msg: RoomMsg | null = state && me ? { game, host: me, ...viewOf(game, state, me) } : null;
  return { msg, status, me, act: dispatch };
}

// ---------- guest: says hello, sends actions, receives its own view ----------
export function useGuestRoom(code: string, token: string, name: string) {
  const [msg, setMsg] = useState<RoomMsg | null>(null);
  const [me, setMe] = useState("");
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const inbox = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!code || !token || !name || !me) return;
    const rt = client(code, token, () => {}, () => setStatus("nosetup"));
    const own = rt.channels.get(`room:${code}:p:${me}`);
    const host = rt.channels.get(`room:${code}:host`);
    inbox.current = host;
    own.subscribe("state", (m) => {
      setMsg(m.data as RoomMsg);
      setStatus("open");
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    // On every (re)connect: rejoin presence and say hello, so the host re-seats us.
    const hello = async () => {
      await host.presence.enter({ name });
      await host.publish("hello", { name });
      const members = await host.presence.get();
      if (!members.some((p) => (p.data as { host?: boolean })?.host)) {
        setStatus("waiting");
        clearTimeout(timer);
        timer = setTimeout(() => setStatus((s) => (s === "waiting" ? "missing" : s)), 8000);
      }
    };
    rt.connection.on("connected", () => void hello().catch(() => setStatus("offline")));
    rt.connection.on("disconnected", () => setStatus("offline"));
    return () => {
      clearTimeout(timer);
      rt.close();
    };
  }, [code, token, name, me]);

  // Learn our player id first (it names our private channel).
  useEffect(() => {
    if (!code || !token || me) return;
    const cached = loadSession<string>(`imposter:pid:${code}:${token}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reuse this tab's id after a refresh
    if (cached) return setMe(cached);
    void fetch(`/api/ably?t=${token}&code=${code}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 503) return setStatus("nosetup");
        const tr = (await r.json()) as Ably.TokenRequest;
        if (tr.clientId) {
          saveSession(`imposter:pid:${code}:${token}`, tr.clientId);
          setMe(tr.clientId);
        }
      })
      .catch(() => setStatus("offline"));
  }, [code, token, me]);

  const act = useCallback((a: AnyAction) => void inbox.current?.publish("action", { action: a }), []);
  return { msg, status, me, act };
}
