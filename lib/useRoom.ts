"use client";
import PartySocket from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Secret } from "./game";

export type Game = "imposter" | "mafia";
export type RoomMsg = { type: "state"; game: Game; host: string; state: unknown; secret: Secret | null };
export type RoomStatus = "connecting" | "open" | "missing" | "taken" | "nosetup" | "offline";

// Set NEXT_PUBLIC_PARTYKIT_HOST on Vercel to the deployed party (e.g. guess-the-imposter.<you>.partykit.dev).
const HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST;

export function useRoom(code: string, token: string, name: string, create?: Game) {
  const [msg, setMsg] = useState<RoomMsg | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const sock = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!code || !token || !name) return;
    const local = ["localhost", "127.0.0.1"].includes(location.hostname);
    if (!HOST && !local) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- config problem known only in the browser
      setStatus("nosetup");
      return;
    }
    const s = new PartySocket({ host: HOST ?? "localhost:1999", room: code.toLowerCase() });
    // Re-sent on every (re)connect, so a dropped phone gets its seat back automatically.
    s.addEventListener("open", () => {
      setStatus("open");
      s.send(JSON.stringify({ type: "hello", token, name, create }));
    });
    s.addEventListener("close", () => setStatus((st) => (st === "missing" || st === "taken" ? st : "offline")));
    s.addEventListener("message", (e) => {
      let m: RoomMsg | { type: "missing" | "taken" };
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "state") return setMsg(m);
      setStatus(m.type);
      s.close(); // stop reconnecting to a room that isn't there
    });
    sock.current = s;
    return () => s.close();
  }, [code, token, name, create]);

  const act = useCallback((action: unknown) => sock.current?.send(JSON.stringify({ type: "action", action })), []);
  return { msg, status, act };
}
