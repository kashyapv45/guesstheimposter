"use client";
import { imposterCount, recommendImposters, type GameState, type Settings } from "@/lib/game";
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
                className={`flex min-h-12 flex-1 items-center justify-between gap-2 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge px-3 text-left ${on ? "border-amber bg-amber/10 text-amber shadow-[0_0_14px_rgb(var(--glow)/.25)]" : "bg-field"}`}
              >
                <span className="font-bold">{c.name}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase opacity-80">
                  {left} / {total} left
                </span>
              </button>
              <button aria-label={`Reshuffle ${c.name}`} title="Reshuffle crate" onClick={() => deck.reshuffle(c.id)} className="h-12 w-12 shrink-0 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field font-mono text-lg">
                ↺
              </button>
            </li>
          );
        })}
      </ul>
    </Sleeve>
  );
}

// Who won the round, the word, and who was who.
export function ResultView({ state }: { state: GameState }) {
  const { round, outcome } = state;
  if (!round || !outcome) return null;
  const name = (id: string | null) => state.players.find((p) => p.id === id)?.name ?? "?";
  const headline =
    outcome.winner === "crew"
      ? `${name(outcome.eliminated)} was the imposter. Crew wins!`
      : outcome.eliminated
        ? `${name(outcome.eliminated)} was crew. Imposters win!`
        : "Hung jury. The imposters slip away!";
  return (
    <>
      <Sleeve dark>
        <p className="font-mono text-xs uppercase tracking-widest opacity-70">The word was</p>
        <p className="font-serif text-3xl font-black text-amber">{round.word}</p>
        <p className="font-mono text-xs opacity-70">{round.categoryName}</p>
        <p className="mt-3 font-serif text-xl font-bold">{headline}</p>
      </Sleeve>
      <Sleeve title="Who was who">
        <ul className="space-y-1">
          {round.order.map((id) => (
            <li key={id} className="flex justify-between gap-2">
              <span className="truncate">{name(id)}</span>
              <span className={`font-mono text-sm font-bold ${round.roles[id] === "imposter" ? "text-crimson" : ""}`}>{round.roles[id] === "imposter" ? "Imposter" : "Crew"}</span>
            </li>
          ))}
        </ul>
      </Sleeve>
    </>
  );
}
