"use client";
// Host lobbies for online rooms, plus the shareable room code card.
import { useState } from "react";
import { describe } from "@/lib/describe";
import type { Action, GameState } from "@/lib/game";
import { mafiaCount, MAX_PLAYERS, MIN_PLAYERS, recommendMafia, type MAction, type MState } from "@/lib/mafia";
import { formatCode } from "@/lib/roomCode";
import { useTheme } from "@/lib/theme";
import { useWordDeck } from "@/lib/useWordDeck";
import { PlayerList } from "./GameView";
import { CratePicker, SettingsPanel } from "./panels";
import { Button, Screen, Sleeve, Stepper, Toggle } from "./ui";

export function CodeCard({ code, game }: { code: string; game: string }) {
  const [note, setNote] = useState("Tap to share the join link");
  const link = typeof location === "undefined" ? "" : `${location.origin}/room/${code}`;
  return (
    <Sleeve dark className="text-center">
      <button
        className="w-full"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: game, text: `Join my ${game} room: ${formatCode(code)}`, url: link });
            else {
              await navigator.clipboard.writeText(link);
              setNote("Join link copied");
            }
          } catch {}
        }}
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-70">Room code</p>
        <p className="font-mono text-4xl font-bold tracking-widest text-amber [text-shadow:0_0_10px_rgb(var(--glow)/.5)]">{formatCode(code)}</p>
        <p className="mt-1 text-xs opacity-70">{note}</p>
      </button>
    </Sleeve>
  );
}

export function ImposterLobby({ code, state, act }: { code: string; state: GameState; act: (a: Action) => void }) {
  const deck = useWordDeck();
  const [kit] = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = state.players.filter((p) => p.connected).length;
  const start = async () => {
    const w = deck.draw(state.settings.categories);
    if (!w) return setError("Pick at least one category.");
    setError("");
    setBusy(true);
    const desc = await describe(w);
    setBusy(false);
    act({ type: "start", secret: { word: w.word, category: w.category, categoryName: w.categoryName, desc }, now: Date.now(), seed: (Math.random() * 2 ** 32) >>> 0 });
  };
  return (
    <Screen
      title="Guess the Imposter"
      kicker="Online room · you're the host"
      actions={
        <>
          {error && <p className="text-sm text-crimson">{error}</p>}
          <Button disabled={busy || ready < 3 || !state.settings.categories.length} onClick={start}>
            {ready < 3 ? `Need ${3 - ready} more player${ready === 2 ? "" : "s"}` : kit.deal}
          </Button>
        </>
      }
    >
      <CodeCard code={code} game="Guess the Imposter" />
      <Sleeve title={`Players (${state.players.length} / 16)`}>
        <PlayerList players={state.players} showLinks />
      </Sleeve>
      <SettingsPanel settings={state.settings} players={ready} onChange={(settings) => act({ type: "settings", settings })} />
      <CratePicker deck={deck} selected={state.settings.categories} onChange={(categories) => act({ type: "settings", settings: { categories } })} />
    </Screen>
  );
}

export function MafiaLobby({ code, state, act }: { code: string; state: MState; act: (a: MAction) => void }) {
  const ready = state.players.filter((p) => p.connected).length;
  const n = Math.max(MIN_PLAYERS, ready);
  const s = state.settings;
  const max = Math.max(1, Math.floor((n - 1) / 2));
  const set = (settings: Partial<MState["settings"]>) => act({ type: "settings", settings });
  return (
    <Screen
      title="Mafia"
      kicker="Online room · you're the host"
      actions={
        <Button disabled={ready < MIN_PLAYERS} onClick={() => act({ type: "start", seed: (Math.random() * 2 ** 32) >>> 0 })}>
          {ready < MIN_PLAYERS ? `Need ${MIN_PLAYERS - ready} more player${MIN_PLAYERS - ready === 1 ? "" : "s"}` : "Deal the roles"}
        </Button>
      }
    >
      <CodeCard code={code} game="Mafia" />
      <Sleeve title={`Players (${state.players.length} / ${MAX_PLAYERS})`}>
        <PlayerList players={state.players} showLinks />
      </Sleeve>
      <Sleeve title="Settings">
        <div className="space-y-4">
          <Toggle label="Auto mafia count" hint={`Recommended for ${n} players: ${recommendMafia(n)}`} on={s.mafia == null} onChange={(auto) => set({ mafia: auto ? null : mafiaCount(s, n) })} />
          {s.mafia != null && <Stepper label="Mafia" value={Math.min(s.mafia, max)} min={1} max={max} onChange={(v) => set({ mafia: v })} />}
          <Toggle label="Doctor" hint="Saves one player each night" on={s.doctor} onChange={(doctor) => set({ doctor })} />
          <Toggle label="Detective" hint="Checks one player each night" on={s.detective} onChange={(detective) => set({ detective })} />
          <Toggle label="Reveal roles on death" on={s.revealOnDeath} onChange={(revealOnDeath) => set({ revealOnDeath })} />
          <Toggle label="Day timer" on={s.daySeconds > 0} onChange={(on) => set({ daySeconds: on ? 180 : 0 })} />
          {s.daySeconds > 0 && <Stepper label="Seconds" value={s.daySeconds} min={60} max={600} step={30} onChange={(v) => set({ daySeconds: v })} />}
        </div>
      </Sleeve>
    </Screen>
  );
}
