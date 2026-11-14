"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Led, Rocker, Screen, Sleeve, Vinyl } from "@/components/ui";
import { cleanCode, formatCode, isValidCode } from "@/lib/roomCode";

type Mode = "pass" | "online" | "lan";

const MODE_INFO: Record<Mode, { led: "green" | "amber" | "off"; text: string }> = {
  pass: { led: "off", text: "One phone, passed around the table. No internet needed." },
  online: { led: "amber", text: "Everyone on their own phone, anywhere. Join with an 8-character code." },
  lan: { led: "green", text: "Same Wi-Fi or hotspot. Phones talk directly. Works with no internet using QR codes." },
};

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pass");
  const [code, setCode] = useState("");
  const clean = cleanCode(code);

  return (
    <Screen
      title="Guess the Imposter"
      kicker="Side A · 33⅓ RPM"
      actions={
        mode === "pass" ? (
          <Button onClick={() => router.push("/play")}>Start Pass &amp; Play</Button>
        ) : (
          <>
            <Button onClick={() => router.push(`/room?mode=${mode}`)}>Create room</Button>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (isValidCode(clean)) router.push(`/join/${clean}`);
              }}
            >
              <input
                value={formatCode(clean)}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VNL7-K92P"
                aria-label="Room code"
                autoCapitalize="characters"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border-2 border-charcoal bg-cream px-3 font-mono text-xl uppercase tracking-widest"
              />
              <Button variant="secondary" className="!w-auto" disabled={!isValidCode(clean)}>
                Join
              </Button>
            </form>
            {clean.length === 8 && !isValidCode(clean) && <p className="text-sm text-orange">Codes never use 0, O, 1, I or L.</p>}
          </>
        )
      }
    >
      <div className="flex justify-center py-2">
        <Vinyl size={200} label={<span className="font-serif text-xs font-black leading-tight text-cream">WHO&apos;S<br />THE<br />FAKE?</span>} />
      </div>
      <Sleeve title="How to play">
        <p>Everyone gets the same secret word, except the imposter. Take turns giving one-word clues, then vote out whoever seems to be bluffing.</p>
      </Sleeve>
      <Sleeve title="Connection">
        <Rocker
          label="Play mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "pass", label: "Pass & Play" },
            { value: "online", label: "Online" },
            { value: "lan", label: "Local Wi-Fi" },
          ]}
        />
        <p className="mt-3 flex items-start gap-2 text-sm">
          <span className="mt-1.5">
            <Led color={MODE_INFO[mode].led} />
          </span>
          {MODE_INFO[mode].text}
        </p>
      </Sleeve>
    </Screen>
  );
}
