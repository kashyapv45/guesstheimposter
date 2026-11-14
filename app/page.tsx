"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Led, Rocker, Screen, Sleeve, Vinyl } from "@/components/ui";
import { clearSession, HOST_KEY } from "@/lib/session";

type Mode = "pass" | "lan";

const MODE_INFO: Record<Mode, { led: "green" | "off"; text: string }> = {
  pass: { led: "off", text: "One phone, passed around the table." },
  lan: {
    led: "green",
    text: "Everyone on their own phone, on the same Wi-Fi or hotspot. The host shows an invite QR, each player scans it and shows a reply QR back. No setup, no server: phones talk directly over your network.",
  },
};

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pass");

  return (
    <Screen
      title="Guess the Imposter"
      kicker="Side A · 33⅓ RPM"
      actions={
        mode === "pass" ? (
          <Button onClick={() => router.push("/play")}>Start Pass &amp; Play</Button>
        ) : (
          <>
            <Button
              onClick={() => {
                clearSession(HOST_KEY); // a new room replaces the one this tab was hosting
                router.push("/room");
              }}
            >
              Host a room
            </Button>
            <p className="text-center text-xs text-ink/60">Joining? Scan the host&apos;s invite QR with your camera.</p>
          </>
        )
      }
    >
      <div className="flex justify-center py-2">
        <Vinyl size={220} label={<span className="font-serif text-[10px] font-black leading-[1.15] tracking-tight text-chassis">WHO&apos;S<br />THE<br />IMPOSTER?</span>} />
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
