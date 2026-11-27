"use client";
// Online rooms on Ably. The host's phone runs the game; Ably relays messages.
//   room:<CODE>:host      guests -> host (hello / action); presence shows who is connected
//   room:<CODE>:p:<pid>   host -> one player (their own redacted view)
// Ably authenticates every message's clientId (pid), so the host knows who sent what.
import { createClient, type PubSubClient, type RealtimeChannel, type TokenRequest } from "@ably/pubsub-device";
import { useCallback, useEffect, useRef, useState } from "react";
import { newGame, reduce as reduceImposter, viewFor, type Action as IAction, type GameState, type Secret } from "./game";
import { newMafia, reduceMafia, viewMafia, type MAction, type MState } from "./mafia";
import { clearSession, guestKey, loadSession, saveSession } from "./session";

export type Game = "imposter" | "mafia";
export type RoomMsg = {
  game: Game;
  host: string;
  hostKey?: string;
  state: unknown;
  secret: Secret | null;
};
export type RoomStatus = "connecting" | "open" | "waiting" | "missing" | "nosetup" | "offline" | "kicked";
type AnyAction = IAction | MAction;

const GUEST_ONLY: Record<Game, Set<string>> = {
  imposter: new Set(["revealed", "vote", "unvote"]),
  mafia: new Set(["revealed", "night", "vote", "unvote"]),
};

function client(
  code: string,
  token: string,
  onId: (pid: string) => void,
  onNoSetup: () => void,
  onError?: (err: string) => void,
  claimHost?: string,
) {
  return createClient({
    authCallback: async (_params, cb) => {
      try {
        const claimParam = claimHost ? `&claimHost=${encodeURIComponent(claimHost)}` : "";
        const r = await fetch(`/api/ably?t=${token}&code=${code}${claimParam}`, { cache: "no-store" });
        if (r.status === 503) {
          onNoSetup();
          return cb("nosetup", null);
        }
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          const err = body.error || `HTTP ${r.status}`;
          onError?.(err);
          return cb(err, null);
        }
        const tr = (await r.json()) as TokenRequest;
        if (tr.clientId) onId(tr.clientId);
        cb(null, tr);
      } catch (e) {
        const err = String(e);
        onError?.(err);
        cb(err, null);
      }
    },
  });
}

const viewOf = (game: Game, s: GameState | MState, pid: string) =>
  game === "imposter" ? viewFor(s as GameState, pid) : { state: viewMafia(s as MState, pid), secret: null };

// ---------- host: runs the rules, sends each player their own view ----------
export function useHostRoom(
  code: string,
  token: string,
  name: string,
  game: Game,
  claimHost?: string,
  initialState?: unknown,
) {
  const saveKey = `imposter:hoststate:${code}`;
  const [state, setState] = useState<GameState | MState | null>(null);
  const [me, setMe] = useState("");
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [tick, setTick] = useState(0); // forces a resend when a player says hello again
  const ably = useRef<PubSubClient | null>(null);
  const kickedRef = useRef<Set<string>>(new Set());
  const hasName = !!name;

  const dispatch = useCallback(
    (a: AnyAction) => setState((s) => (s ? (game === "imposter" ? reduceImposter(s as GameState, a as IAction) : reduceMafia(s as MState, a as MAction)) : s)),
    [game],
  );

  useEffect(() => {
    if (!code || !token || !hasName) return;
    // Restore after a refresh (1 hour); players show as dropped until their phones say hello again.
    const saved = loadSession<GameState | MState>(saveKey);
    const restored = saved ? ({ ...saved, players: saved.players.map((p) => ({ ...p, connected: false })) } as GameState | MState) : null;
    const rt = client(code, token, setMe, () => setStatus("nosetup"), () => setStatus("offline"), claimHost);
    ably.current = rt;
    const inbox = rt.channels.get(`room:${code}:host`);
    const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const onConnect = () => {
      setStatus("open");
      void inbox.presence.enter({ host: true }).catch(() => { });
      setTick((t) => t + 1);
    };

    if (rt.connection.state === "connected") onConnect();
    rt.connection.on("connected", onConnect);
    rt.connection.on("disconnected", () => setStatus("offline"));
    rt.connection.on("suspended", () => setStatus("offline"));
    rt.connection.on("failed", () => setStatus("offline"));

    inbox.subscribe("hello", (m) => {
      if (!m.clientId) return;
      const t = leaveTimers.get(m.clientId);
      if (t) {
        clearTimeout(t);
        leaveTimers.delete(m.clientId);
      }
      if (kickedRef.current.has(m.clientId)) {
        void rt.channels.get(`room:${code}:p:${m.clientId}`).publish("kicked", {}).catch(() => { });
        return;
      }
      setState((s) => {
        if (!s) return s;
        const a = { type: "join", id: m.clientId!, name: String((m.data as { name?: unknown })?.name ?? "Player") } as AnyAction;
        return game === "imposter" ? reduceImposter(s as GameState, a as IAction) : reduceMafia(s as MState, a as MAction);
      });
      setTick((t) => t + 1);
    });

    inbox.subscribe("action", (m) => {
      const a = (m.data as { action?: AnyAction })?.action;
      if (!m.clientId || !a || typeof a !== "object" || kickedRef.current.has(m.clientId)) return;
      const x = a as { type: string; id?: string; voter?: string };
      if (!GUEST_ONLY[game].has(x.type) || (x.id ?? x.voter) !== m.clientId) return; // guests act only for themselves
      dispatch(a);
    });

    inbox.presence.subscribe((m) => {
      if (!m.clientId) return;
      const pid = m.clientId;
      const isHostMember = (m.data as { host?: boolean })?.host;
      if (m.action === "enter" || m.action === "present" || m.action === "update") {
        if (!isHostMember) {
          const t = leaveTimers.get(pid);
          if (t) {
            clearTimeout(t);
            leaveTimers.delete(pid);
          }
          if (kickedRef.current.has(pid)) return;
          const playerName = String((m.data as { name?: unknown })?.name ?? "Player");
          dispatch({ type: "join", id: pid, name: playerName } as AnyAction);
          setTick((t) => t + 1);
        }
      } else if (m.action === "leave") {
        if (!isHostMember && !leaveTimers.has(pid)) {
          // Short grace period so brief phone/tab switches don't immediately flicker disconnected.
          leaveTimers.set(
            pid,
            setTimeout(() => {
              leaveTimers.delete(pid);
              dispatch({ type: "connected", id: pid, connected: false } as AnyAction);
            }, 5000),
          );
        }
      }
    });

    const onWake = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (rt.connection.state !== "connected") rt.connection.connect();
      else {
        void inbox.presence.enter({ host: true }).catch(() => { });
        setTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);

    void inbox.presence.enter({ host: true }).catch(() => { });
    // If promoted from guest, reset to lobby with kept players so the game can continue cleanly
    const initial = initialState
      ? game === "imposter"
        ? ({ ...(initialState as GameState), phase: "lobby", round: null, revealed: [], votes: {}, candidates: null, outcome: null, turn: 0, timerEnd: null } as GameState)
        : ({ ...newMafia((initialState as MState).settings), players: (initialState as MState).players, phase: "lobby" } as MState)
      : (restored ?? (game === "imposter" ? newGame() : newMafia()));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- room state is created when the connection is set up
    setState(initial);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
      for (const t of leaveTimers.values()) clearTimeout(t);
      leaveTimers.clear();
      rt.close();
    };
  }, [code, token, hasName, game, saveKey, dispatch, claimHost, initialState]);

  // Host plays too.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seat the host once Ably tells us its id
    if (me) dispatch({ type: "join", id: me, name } as AnyAction);
  }, [me, name, dispatch]);

  // Send every other player their own view, and keep a copy for refresh recovery.
  useEffect(() => {
    const rt = ably.current;
    if (!state || !rt || !me) return;
    for (const p of state.players) {
      if (p.id !== me && p.connected) {
        void rt.channels.get(`room:${code}:p:${p.id}`).publish("state", {
          game,
          host: me,
          hostKey: claimHost ?? token,
          ...viewOf(game, state, p.id),
        }).catch(() => { });
      }
    }
    saveSession(saveKey, state);
  }, [state, tick, me, code, game, saveKey, claimHost, token]);

  const act = useCallback(
    (a: AnyAction) => {
      if (a.type === "leave" && a.id !== me) {
        kickedRef.current.add(a.id);
        void ably.current?.channels.get(`room:${code}:p:${a.id}`).publish("kicked", {}).catch(() => { });
      }
      if (a.type === "start" && game === "mafia") {
        dispatch({ ...a, hostId: (a as { hostId?: string }).hostId ?? me } as AnyAction);
        return;
      }
      dispatch(a);
    },
    [code, dispatch, game, me],
  );

  const msg: RoomMsg | null = state && me ? { game, host: me, ...viewOf(game, state, me) } : null;
  return { msg, status, me, act };
}

// ---------- guest: says hello, sends actions, receives its own view ----------
export function useGuestRoom(
  code: string,
  token: string,
  name: string,
  onPromoteHost?: (game: Game, hostKey: string, lastState: unknown) => void,
) {
  const [msg, setMsg] = useState<RoomMsg | null>(null);
  const [me, setMe] = useState(() => (typeof window !== "undefined" ? loadSession<string>(`imposter:pid:${code}:${token}`) ?? "" : ""));
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [hostMissingSeconds, setHostMissingSeconds] = useState<number | null>(null);
  const inbox = useRef<RealtimeChannel | null>(null);
  const msgRef = useRef<RoomMsg | null>(null);
  const meRef = useRef(me);
  const hostKeyRef = useRef<string | null>(null);
  const onPromoteHostRef = useRef(onPromoteHost);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    msgRef.current = msg;
    if (msg?.hostKey) hostKeyRef.current = msg.hostKey;
  }, [msg]);

  useEffect(() => {
    onPromoteHostRef.current = onPromoteHost;
  }, [onPromoteHost]);

  useEffect(() => {
    if (!code || !token || !name) return;
    let cancelled = false;
    let missingTimer: ReturnType<typeof setTimeout> | undefined;
    let retryInterval: ReturnType<typeof setInterval> | undefined;
    let hostDisconnectInterval: ReturnType<typeof setInterval> | undefined;
    let hostMissingLeft = 60;
    const subscribed = new Set<string>();

    const startHostCountdown = () => {
      if (hostDisconnectInterval || !msgRef.current) return;
      hostMissingLeft = 60;
      setHostMissingSeconds(60);
      hostDisconnectInterval = setInterval(async () => {
        if (cancelled) return;
        hostMissingLeft -= 1;
        if (hostMissingLeft <= 0) {
          clearInterval(hostDisconnectInterval);
          hostDisconnectInterval = undefined;
          setHostMissingSeconds(null);
          // 1 minute expired without host: elect another host
          try {
            const members = await host.presence.get();
            const guestMembers = members.filter((m) => !(m.data as { host?: boolean })?.host);
            if (!guestMembers.length) return;
            guestMembers.sort((a, b) => a.clientId.localeCompare(b.clientId));
            const electedId = guestMembers[0].clientId;
            if (meRef.current === electedId && hostKeyRef.current && msgRef.current) {
              onPromoteHostRef.current?.(msgRef.current.game, hostKeyRef.current, msgRef.current.state);
            }
          } catch (err) {
            console.warn("Host election failed:", err);
          }
        } else {
          setHostMissingSeconds(hostMissingLeft);
        }
      }, 1000);
    };

    const stopHostCountdown = () => {
      if (hostDisconnectInterval) {
        clearInterval(hostDisconnectInterval);
        hostDisconnectInterval = undefined;
      }
      setHostMissingSeconds(null);
    };

    const setupPrivate = (pid: string, clientRt: PubSubClient) => {
      if (subscribed.has(pid)) return;
      subscribed.add(pid);
      const own = clientRt.channels.get(`room:${code}:p:${pid}`);
      own.subscribe("state", (m) => {
        if (cancelled) return;
        const data = m.data as RoomMsg;
        msgRef.current = data;
        if (data.hostKey) hostKeyRef.current = data.hostKey;
        setMsg(data);
        setStatus("open");
        clearInterval(retryInterval);
        clearTimeout(missingTimer);
        stopHostCountdown();
      });
      own.subscribe("kicked", () => {
        if (cancelled) return;
        cancelled = true;
        clearInterval(retryInterval);
        clearTimeout(missingTimer);
        stopHostCountdown();
        void clientRt.channels.get(`room:${code}:host`).presence.leave().catch(() => { });
        clearSession(guestKey(code));
        clearSession(`imposter:pid:${code}:${token}`);
        setMsg(null);
        setStatus("kicked");
        clientRt.close();
      });
    };

    const rt = client(
      code,
      token,
      (pid) => {
        if (cancelled) return;
        saveSession(`imposter:pid:${code}:${token}`, pid);
        setMe(pid);
        setupPrivate(pid, rt);
      },
      () => {
        if (!cancelled) setStatus("nosetup");
      },
      (err) => {
        if (!cancelled) {
          if (err.includes("bad code") || err.includes("bad secret")) setStatus("missing");
          else setStatus("offline");
        }
      },
    );

    const host = rt.channels.get(`room:${code}:host`);
    inbox.current = host;

    const cachedPid = loadSession<string>(`imposter:pid:${code}:${token}`);
    if (cachedPid) setupPrivate(cachedPid, rt);

    const sayHello = async () => {
      try {
        await host.presence.enter({ name });
        await host.publish("hello", { name });
        const members = await host.presence.get();
        if (cancelled) return;
        const hasHost = members.some((p) => (p.data as { host?: boolean })?.host);
        if (hasHost) {
          stopHostCountdown();
        } else {
          if (!msgRef.current) {
            setStatus("waiting");
            clearTimeout(missingTimer);
            missingTimer = setTimeout(() => {
              if (!cancelled && !msgRef.current) setStatus("missing");
            }, 8000);
          } else {
            startHostCountdown();
          }
        }
      } catch (err) {
        console.warn("Guest sayHello error:", err);
      }
    };

    // React immediately if host enters presence or leaves
    host.presence.subscribe((m) => {
      if (cancelled) return;
      if ((m.data as { host?: boolean })?.host) {
        if (m.action === "enter" || m.action === "present") {
          clearTimeout(missingTimer);
          stopHostCountdown();
          if (!msgRef.current) setStatus("connecting");
          void host.publish("hello", { name }).catch(() => { });
        } else if (m.action === "leave") {
          if (!msgRef.current) {
            setStatus("waiting");
            clearTimeout(missingTimer);
            missingTimer = setTimeout(() => {
              if (!cancelled && !msgRef.current) setStatus("missing");
            }, 8000);
          } else {
            startHostCountdown();
          }
        }
      }
    });

    const onConnect = () => {
      void sayHello();
      clearInterval(retryInterval);
      retryInterval = setInterval(() => {
        if (cancelled) return;
        if (!msgRef.current && rt.connection.state === "connected") {
          void host.publish("hello", { name }).catch(() => { });
        }
      }, 2000);
    };

    if (rt.connection.state === "connected") onConnect();
    rt.connection.on("connected", onConnect);
    rt.connection.on("disconnected", () => {
      if (!cancelled) setStatus("offline");
      clearInterval(retryInterval);
    });
    rt.connection.on("suspended", () => {
      if (!cancelled) setStatus("offline");
      clearInterval(retryInterval);
    });
    rt.connection.on("failed", () => {
      if (!cancelled) setStatus("offline");
      clearInterval(retryInterval);
    });

    const onWake = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (rt.connection.state !== "connected") rt.connection.connect();
      else void sayHello();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      clearTimeout(missingTimer);
      clearInterval(retryInterval);
      stopHostCountdown();
      subscribed.clear();
      rt.close();
    };
  }, [code, token, name]);

  const act = useCallback((a: AnyAction) => void inbox.current?.publish("action", { action: a }).catch(() => { }), []);
  return { msg, status, me, act, hostMissingSeconds };
}
