"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameView } from "@/components/GameView";
import { Button, CopyText, QR, Screen, Sleeve, Vinyl } from "@/components/ui";
import type { GameState, Secret } from "@/lib/game";
import { GuestNet, type GuestStatus } from "@/lib/net";
import { cleanCode, formatCode, isValidCode, randomId } from "@/lib/roomCode";

type Saved = { token: string; name: string };

export default function JoinClient() {
  const [code, setCode] = useState("");
  const [offer, setOffer] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<GuestStatus>("idle");
  const [view, setView] = useState<{ state: GameState; secret: Secret | null } | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const net = useRef<GuestNet | null>(null);
  const [me, setMe] = useState(""); // session token: survives refresh, so the host keeps our seat

  const connect = async (c: string, n: string, invite: string | null, token = me) => {
    try {
      sessionStorage.setItem(`imposter:guest:${c}`, JSON.stringify({ token, name: n } satisfies Saved));
    } catch {}
    net.current?.close();
    const g = new GuestNet(c, token, n, {
      message: (m) => setView({ state: m.state, secret: m.secret }),
      status: setStatus,
    });
    net.current = g;
    if (invite) {
      try {
        setAnswer(await g.connectViaInvite(invite));
      } catch {
        setStatus("failed");
      }
    } else void g.connectViaServer();
  };

  // Code + optional offline invite come from the URL; a saved token means we rejoin after a refresh.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of URL + sessionStorage after hydration */
  useEffect(() => {
    const c = cleanCode(location.pathname.split("/")[2] ?? "");
    const inv = location.hash.match(/o=([^&]+)/)?.[1] ?? null;
    setCode(c);
    setOffer(inv);
    let saved: Saved | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(`imposter:guest:${c}`) ?? "null");
    } catch {}
    const token = saved?.token ?? randomId();
    setMe(token);
    if (saved?.name) {
      setName(saved.name);
      if (isValidCode(c) && !inv) void connect(c, saved.name, null, token);
    }
    return () => net.current?.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  if (view && status !== "failed" && status !== "missing") {
    return (
      <>
        {status === "reconnecting" && <p className="sticky top-0 z-10 bg-mustard py-1 text-center font-mono text-xs uppercase">Reconnecting…</p>}
        <GameView state={view.state} secret={view.secret} me={me} isHost={false} act={(a) => net.current?.send(a)} />
      </>
    );
  }

  if (!isValidCode(code))
    return (
      <Screen title="Hmm, that code">
        <Sleeve>
          <p>That doesn&apos;t look like a room code. Codes are 8 characters, like VNL7-K92P.</p>
        </Sleeve>
        <Link href="/" className="underline">Go to the home screen</Link>
      </Screen>
    );

  if (status === "idle")
    return (
      <Screen
        title="Join the room"
        kicker={`Cat. No. ${formatCode(code)}`}
        actions={
          <Button disabled={!name.trim()} onClick={() => connect(code, name.trim(), offer)}>
            {offer ? "Join over Wi-Fi" : "Join"}
          </Button>
        }
      >
        <Sleeve title="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" aria-label="Your name" autoFocus className="w-full rounded-lg border-2 border-charcoal bg-cream px-3 py-3 text-lg" />
        </Sleeve>
      </Screen>
    );

  if (status === "missing" || status === "failed")
    return (
      <Screen title={status === "missing" ? "Room not found" : "Couldn't connect"} actions={<Button onClick={() => (setAnswer(null), setStatus("idle"))}>Try again</Button>}>
        <Sleeve>
          <p>
            {status === "missing"
              ? "No room with that code. Check the code with your host. Rooms close after 4 hours."
              : offer
                ? "The Wi-Fi link didn't come up. Ask the host for a fresh invite QR and make sure you're on the same Wi-Fi."
                : "Couldn't reach the host. Check you're online and the host still has the room open."}
          </p>
        </Sleeve>
        <Link href="/" className="underline">Home</Link>
      </Screen>
    );

  if (answer && status !== "connected")
    return (
      <Screen title="Show the host" kicker="Offline handshake">
        <Sleeve>
          <p className="mb-3 text-sm">Let the host scan this reply code. You&apos;ll connect straight over the Wi-Fi.</p>
          <QR text={answer} size={280} />
          <div className="mt-3">
            <CopyText text={answer} label="Copy reply code" />
          </div>
        </Sleeve>
      </Screen>
    );

  return (
    <Screen title="Dropping the needle…" kicker={`Cat. No. ${formatCode(code)}`}>
      <div className="flex justify-center py-6">
        <Vinyl size={200} />
      </div>
      <p className="text-center font-mono text-sm uppercase tracking-widest">{status === "reconnecting" ? "Reconnecting to the host…" : "Connecting to the host…"}</p>
    </Screen>
  );
}
