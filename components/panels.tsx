"use client";
import { useState } from "react";
import { imposterCount, recommendImposters, POINTS, type GameState, type Settings } from "@/lib/game";
import type { WordDeck } from "@/lib/useWordDeck";
import { Rocker, Sleeve, Stepper, Toggle } from "./ui";

export function SettingsPanel({ settings, players, onChange }: { settings: Settings; players: number; onChange: (s: Partial<Settings>) => void }) {
  const n = Math.max(3, players);
  const max = Math.max(1, Math.floor((n - 1) / 2));
  return (
    <Sleeve title="Settings">
      <div className="space-y-4">
        <Toggle
          label="Auto imposters"
          hint={`Recommended for ${n} players: ${recommendImposters(n)}`}
          on={settings.imposters == null}
          onChange={(auto) => onChange({ imposters: auto ? null : imposterCount(settings, n) })}
        />
        {settings.imposters != null && <Stepper label="Imposters" value={Math.min(settings.imposters, max)} min={1} max={max} onChange={(v) => onChange({ imposters: v })} />}
        <div className="space-y-2">
          <p className="font-bold">What the imposter sees</p>
          <Rocker
            label="Imposter hint"
            value={settings.hint}
            onChange={(hint) => onChange({ hint })}
            options={[
              { value: "category", label: "Category" },
              { value: "decoy", label: "Decoy word" },
              { value: "blind", label: "Hardcore" },
            ]}
          />
        </div>
        <Toggle label="Mr. White" hint="One player gets a blank label (6+ players works best)" on={settings.mrWhite} onChange={(mrWhite) => onChange({ mrWhite })} />
        <div className="space-y-2">
          <p className="font-bold">Timer</p>
          <Rocker
            label="Timer"
            value={settings.timerMode}
            onChange={(timerMode) => onChange({ timerMode })}
            options={[
              { value: "off", label: "Off" },
              { value: "discussion", label: "Discussion" },
              { value: "turn", label: "Per clue" },
            ]}
          />
          {settings.timerMode === "discussion" && (
            <Stepper label="Seconds" value={settings.discussionSeconds} min={60} max={300} step={30} onChange={(v) => onChange({ discussionSeconds: v })} />
          )}
          {settings.timerMode === "turn" && <Stepper label="Seconds each" value={settings.turnSeconds} min={15} max={45} step={5} onChange={(v) => onChange({ turnSeconds: v })} />}
        </div>
      </div>
    </Sleeve>
  );
}

export function CratePicker({ selected, onChange, deck }: { selected: string[]; onChange: (ids: string[]) => void; deck: WordDeck }) {
  const [name, setName] = useState("");
  const [words, setWords] = useState("");
  const parsed = [...new Set(words.split(/[\n,]/).map((w) => w.trim()).filter(Boolean))];
  return (
    <Sleeve title="Crate (pick categories)">
      <ul className="space-y-2">
        {deck.categories.map((c) => {
          const on = selected.includes(c.id);
          const { left, total } = deck.stats(c.id);
          return (
            <li key={c.id} className="flex items-center gap-2">
              <button
                role="checkbox"
                aria-checked={on}
                onClick={() => onChange(on ? selected.filter((id) => id !== c.id) : [...selected, c.id])}
                className={`flex min-h-12 flex-1 items-center justify-between gap-2 rounded-lg border-2 border-edge px-3 text-left ${on ? "border-amber bg-amber/10 text-amber shadow-[0_0_14px_rgb(var(--glow)/.25)]" : "bg-field"}`}
              >
                <span className="font-bold">{c.name}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase opacity-80">
                  {left} / {total} left
                </span>
              </button>
              <button aria-label={`Reshuffle ${c.name}`} title="Reshuffle crate" onClick={() => deck.reshuffle(c.id)} className="h-12 w-12 shrink-0 rounded-lg border-2 border-edge bg-field font-mono text-lg">
                ↺
              </button>
              {c.custom && (
                <button aria-label={`Delete ${c.name}`} onClick={() => (deck.removeCustom(c.id), onChange(selected.filter((id) => id !== c.id)))} className="h-12 w-12 shrink-0 rounded-lg border-2 border-edge bg-field font-mono">
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <details className="mt-4">
        <summary className="cursor-pointer font-bold">Add your own word list</summary>
        <div className="mt-2 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="List name" maxLength={30} className="w-full rounded-lg border-2 border-edge bg-field px-3 py-2" />
          <textarea value={words} onChange={(e) => setWords(e.target.value)} placeholder="One word per line (at least 5)" rows={4} className="w-full rounded-lg border-2 border-edge bg-field px-3 py-2" />
          <button
            disabled={!name.trim() || parsed.length < 5}
            onClick={() => {
              const id = deck.addCustom(name.trim(), parsed.map((w) => w.slice(0, 40)));
              onChange([...selected, id]);
              setName("");
              setWords("");
            }}
            className="w-full rounded-lg border-2 border-edge bg-emerald py-2 font-bold text-ink disabled:opacity-40"
          >
            Save list ({parsed.length} words)
          </button>
        </div>
      </details>
    </Sleeve>
  );
}

export function Scoreboard({ state }: { state: GameState }) {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  return (
    <Sleeve title={`Scoreboard · Round ${state.roundNo}`} dark>
      <ol className="space-y-1">
        {sorted.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 font-mono">
            <span className="w-5 opacity-60">{i + 1}</span>
            <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="font-bold">{p.score}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs opacity-60">Crew catch: +{POINTS.crew} · Imposter escape: +{POINTS.imposter} · Mr. White guess: +{POINTS.mrwhite}</p>
    </Sleeve>
  );
}

const ROLE_LABEL = { crew: "Crew", imposter: "Imposter", mrwhite: "Mr. White" };

export function ResultView({ state, canGuess, onGuess }: { state: GameState; canGuess: boolean; onGuess: (word: string) => void }) {
  const [guess, setGuess] = useState("");
  const { round, outcome } = state;
  if (!round || !outcome) return null;
  const name = (id: string | null) => state.players.find((p) => p.id === id)?.name ?? "?";
  if (state.awaitingGuess)
    return (
      <Sleeve title="Caught!" dark>
        <p className="font-serif text-2xl font-black">{name(outcome.eliminated)} was Mr. White!</p>
        <p className="mt-1">One guess at the secret word to steal the win.</p>
        {canGuess ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (guess.trim()) onGuess(guess.trim());
            }}
          >
            <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Your guess" aria-label="Your guess" className="min-w-0 flex-1 rounded-lg border-2 border-edge bg-field px-3 py-2 text-ink" />
            <button className="rounded-lg border-2 border-edge bg-amber px-4 font-bold text-chassis">Guess</button>
          </form>
        ) : (
          <p className="mt-3 font-mono text-sm opacity-70">Waiting for their guess…</p>
        )}
      </Sleeve>
    );
  const headline =
    outcome.winner === "mrwhite"
      ? `${name(outcome.eliminated)} guessed "${outcome.guess}". Mr. White wins!`
      : outcome.winner === "crew"
        ? outcome.guess
          ? `Wrong guess ("${outcome.guess}"). Crew wins!`
          : `${name(outcome.eliminated)} was the imposter. Crew wins!`
        : outcome.eliminated
          ? `${name(outcome.eliminated)} was innocent. Imposters win!`
          : "Hung jury. The imposters slip away!";
  return (
    <>
      <Sleeve dark>
        <p className="font-mono text-xs uppercase tracking-widest opacity-70">The record was</p>
        <p className="font-serif text-3xl font-black text-amber">{round.word}</p>
        <p className="font-mono text-xs opacity-70">{round.categoryName}{state.settings.hint === "decoy" ? ` · decoy: ${round.decoy}` : ""}</p>
        <p className="mt-3 font-serif text-xl font-bold">{headline}</p>
      </Sleeve>
      <Sleeve title="Who was who">
        <ul className="space-y-1">
          {round.order.map((id) => (
            <li key={id} className="flex justify-between gap-2">
              <span className="truncate">{name(id)}</span>
              <span className={`font-mono text-sm font-bold ${round.roles[id] === "crew" ? "" : "text-crimson"}`}>{ROLE_LABEL[round.roles[id]]}</span>
            </li>
          ))}
        </ul>
      </Sleeve>
    </>
  );
}
