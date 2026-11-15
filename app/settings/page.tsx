"use client";
import Link from "next/link";
import { HeroObject } from "@/components/kit";
import { Screen, Sleeve } from "@/components/ui";
import { THEMES, useTheme } from "@/lib/theme";

export default function Settings() {
  const [theme, setTheme] = useTheme();
  return (
    <Screen title="Settings" kicker="Party Kit">
      <Link href="/" className="font-mono text-xs underline">← Party Kit</Link>
      <div className="flex justify-center py-1">
        <HeroObject size={140} />
      </div>
      <Sleeve title="UI kit">
        <div role="radiogroup" aria-label="UI kit" className="grid grid-cols-1 gap-2">
          {THEMES.map((t) => {
            const on = theme.id === t.id;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={on}
                onClick={() => setTheme(t.id)}
                className={`flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[var(--radius-sm)] border-[length:var(--bw)] px-3 text-left transition ${on ? "border-amber bg-amber/10" : "border-edge bg-field"}`}
              >
                <span className="flex shrink-0 overflow-hidden rounded-md border border-edge">
                  {t.swatch.map((c) => (
                    <span key={c} className="h-8 w-4" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t.name}</span>
                  <span className="block truncate text-xs opacity-70">{t.blurb}</span>
                </span>
                <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-amber bg-amber" : "border-edge"}`} />
              </button>
            );
          })}
        </div>
      </Sleeve>
    </Screen>
  );
}
