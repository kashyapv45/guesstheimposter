"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeroObject } from "@/components/kit";
import { Button, Screen, Sleeve } from "@/components/ui";
import { cleanCode, formatCode, isValidCode, newRoomCode } from "@/lib/roomCode";

export default function PartyKit() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const host = (game: "imposter" | "mafia") => router.push(`/room/${newRoomCode()}?create=${game}`);

  return (
    <Screen title="Party Kit" kicker="Side A · 33⅓ RPM" corner={<Link href="/settings" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-panel text-lg">⚙</Link>}>
      <div className="flex justify-center py-1">
        <HeroObject size={180} label={<span className="font-serif text-[9px] leading-[1.15] tracking-tight">PARTY<br />KIT</span>} />
      </div>

      <Sleeve title="Guess the Imposter">
        <p className="mb-3 text-sm">Everyone gets the same secret word except the imposter. Give one-word clues, then vote out the bluffer. 3–16 players.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => router.push("/play")}>Pass &amp; Play</Button>
          <Button onClick={() => host("imposter")}>Host online</Button>
        </div>
      </Sleeve>

      <Sleeve title="Mafia">
        <p className="mb-3 text-sm">Secret roles, night kills, doctor saves and detective checks. The town talks and votes by day. Each player on their own phone. 4–16 players.</p>
        <Button onClick={() => host("mafia")}>Host online</Button>
      </Sleeve>

      <Sleeve title="Join a room">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isValidCode(code)) router.push(`/room/${code}`);
          }}
        >
          <input
            value={formatCode(code)}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="VNL7-K92P"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field px-3 font-mono text-xl uppercase tracking-widest"
          />
          <Button variant="secondary" className="!w-auto" disabled={!isValidCode(code)}>
            Join
          </Button>
        </form>
        {code.length === 8 && !isValidCode(code) && <p className="mt-2 text-sm text-crimson">Codes never use 0, O, 1, I or L.</p>}
      </Sleeve>
    </Screen>
  );
}
