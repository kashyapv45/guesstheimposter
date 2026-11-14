"use client";
import { useRouter } from "next/navigation";
import { Button, Screen, Sleeve, Vinyl } from "@/components/ui";
import { THEMES, useTheme } from "@/lib/theme";

export default function Home() {
  const router = useRouter();
  const [theme, setTheme] = useTheme();

  return (
    <Screen title="Guess the Imposter" kicker="Side A · 33⅓ RPM" actions={<Button onClick={() => router.push("/play")}>Start Pass &amp; Play</Button>}>
      <div className="flex justify-center py-2">
        <Vinyl size={220} label={<span className="font-serif text-[10px] font-black leading-[1.15] tracking-tight text-chassis">WHO&apos;S<br />THE<br />IMPOSTER?</span>} />
      </div>
      <Sleeve title="How to play">
        <p>Everyone gets the same secret word, except the imposter. Pass the phone so each player can peek at their record, give one-word clues, then vote out whoever seems to be bluffing.</p>
      </Sleeve>
      <Sleeve title="UI kit">
        <div role="radiogroup" aria-label="UI kit" className="grid gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => setTheme(t.id)}
              className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-3 text-left transition ${theme === t.id ? "border-amber bg-amber/10" : "border-edge bg-field"}`}
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
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${theme === t.id ? "border-amber bg-amber" : "border-edge"}`} />
            </button>
          ))}
        </div>
      </Sleeve>
    </Screen>
  );
}
