"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameView } from "@/components/GameView";
import { Button, QR, Screen, Sleeve } from "@/components/ui";
import type { GameState, Secret } from "@/lib/game";
import { GuestNet, type GuestStatus } from "@/lib/net";
import { cleanCode, formatCode, randomId } from "@/lib/roomCode";
import { guestKey, loadSession, saveSession } from "@/lib/session";

type Saved = { token: string; name: string };
// Our seat in a room (same token = same seat and role after re-pairing), forgotten after 1 hour idle.
const savedFor = (code: string) => loadSession<Saved>(guestKey(code));

export default function JoinClient() {
  const [code, setCode] = useState("");
  const [offer, setOffer] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<GuestStatus>("idle");
  const [reply, setReply] = useState<string | null>(null);
  const [view, setView] = useState<{ state: GameState; secret: Secret | null } | null>(null);
  const [me, setMe] = useState("");
  const [copied, setCopied] = useState(false);
  const net = useRef<GuestNet | null>(null);

  // The invite (host's compressed offer) arrives in the URL hash from the host's QR.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of URL + sessionStorage after hydration */
  useEffect(() => {
    const c = cleanCode(location.pathname.split("/")[2] ?? "");
    setCode(c);
    setOffer(location.hash.match(/o=([^&]+)/)?.[1] ?? null);
    const saved = savedFor(c);
    if (saved?.name) setName(saved.name);
    // A new invite opened in this same tab only changes the hash, which doesn't reload the page.
    const onHash = () => {
      const next = location.hash.match(/o=([^&]+)/)?.[1];
      if (!next) return;
      net.current?.close();
      setOffer(next);
      setReply(null);
      setView(null);
      setStatus("idle");
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      net.current?.close();
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const join = async () => {
    if (!offer) return;
    const token = savedFor(code)?.token ?? randomId();
    setMe(token);
    saveSession<Saved>(guestKey(code), { token, name: name.trim() });
    history.replaceState(null, "", `/join/${code}`); // an invite works once; a refresh shouldn't reuse it
    setOffer(null);
    net.current?.close();
    const g = new GuestNet(token, name.trim(), {
      message: (m) => setView({ state: m.state, secret: m.secret }),
      status: setStatus,
    });
    net.current = g;
    try {
      setReply(await g.answerInvite(offer));
    } catch {
      setStatus("failed");
    }
  };

  if (view && status === "connected")
    return (
      <GameView
        state={view.state}
        secret={view.secret}
        me={me}
        isHost={false}
        act={(a) => {
          net.current?.send(a);
          saveSession<Saved>(guestKey(code), { token: me, name }); // activity keeps the seat
        }}
      />
    );

  if (status === "lost" || status === "failed")
    return (
      <Screen title={status === "lost" ? "Connection lost" : "Couldn't connect"} kicker={`Cat. No. ${formatCode(code)}`}>
        <Sleeve>
          <p className="text-crimson">
            {status === "lost"
              ? "You dropped off the room."
              : "Your phone couldn't reach the host's phone over the Wi-Fi. Make sure you're on the same Wi-Fi or hotspot (not mobile data or a guest network)."}
          </p>
          <p className="mt-2">Ask the host to tap <b>Invite a player</b> (or the re-pair bar) and scan the new QR with your camera. You keep your seat.</p>
        </Sleeve>
        <Link href="/" className="font-mono text-xs underline">← Home</Link>
      </Screen>
    );

  if (reply)
    return (
      <Screen title="Show the host" kicker={`Cat. No. ${formatCode(code)}`}>
        <Sleeve>
          <p className="mb-3 text-sm">Hold your phone up so the host can scan this reply. You&apos;ll connect straight over the Wi-Fi.</p>
          <QR text={reply} size={280} />
          <button
            className="mt-3 w-full rounded-lg border-2 border-dashed border-edge px-3 py-2 font-mono text-xs"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reply);
                setCopied(true);
              } catch {}
            }}
          >
            {copied ? "Copied" : "Copy reply code instead"}
          </button>
        </Sleeve>
        <p className="text-center font-mono text-xs uppercase tracking-widest text-ink/60">Waiting for the host to scan…</p>
      </Screen>
    );

  if (!offer)
    return (
      <Screen title="Scan the invite" kicker={code ? `Cat. No. ${formatCode(code)}` : "Local Wi-Fi"}>
        <Sleeve>
          <p>To join, the host taps <b>Invite a player</b> and you scan their QR with your phone camera.</p>
          <p className="mt-2 text-sm text-ink/70">Each invite works once. If you refreshed or dropped, ask for a new one; you keep your seat.</p>
        </Sleeve>
        <Link href="/" className="font-mono text-xs underline">← Home</Link>
      </Screen>
    );

  return (
    <Screen
      title="Join the room"
      kicker={`Cat. No. ${formatCode(code)}`}
      actions={
        <Button disabled={!name.trim()} onClick={join}>
          Join
        </Button>
      }
    >
      <Sleeve title="Your name">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" aria-label="Your name" className="w-full rounded-lg border-2 border-edge bg-field px-3 py-3 text-lg" />
      </Sleeve>
      <p className="text-sm text-ink/70">Make sure you&apos;re on the same Wi-Fi or hotspot as the host.</p>
    </Screen>
  );
}
