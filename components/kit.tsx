"use client";
// Frosted Glass signature object: the home-screen hero and the glass card you press-and-hold to see your word.
import type { ReactNode } from "react";

type Props = { size: number; spinning?: boolean; label?: ReactNode; color?: string };

export function HeroObject({ size, spinning = true, label, color = "var(--amber)" }: Props) {
  const s = size * 0.88;
  const medalSize = s * 0.52;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* Soft ambient glass glow behind the frosted card */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full opacity-55 blur-xl"
        style={{ width: s * 0.72, height: s * 0.72, background: color }}
      />
      <div
        className={`frost-card relative flex flex-col items-center justify-between overflow-hidden p-3 text-center ${spinning ? "motion-safe:animate-[float_4s_ease-in-out_infinite]" : ""}`}
        style={{ width: s, height: s }}
      >
        <div className="flex w-full items-center justify-between px-1 font-mono text-[9px] font-bold uppercase tracking-widest text-ink/65 select-none">
          <span>✦</span>
          <span>Frosted</span>
          <span>✦</span>
        </div>

        <div
          className="frost-badge grid place-items-center rounded-full text-center font-bold text-ink"
          style={{ width: medalSize, height: medalSize }}
        >
          {label ?? <span className="font-serif text-xl font-black">✦</span>}
        </div>

        <div className="flex items-center gap-1.5 select-none">
          <span className="h-2 w-2 rounded-full border border-white/80 shadow-xs" style={{ background: color }} />
          <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/55">Party Kit</span>
        </div>
      </div>
    </div>
  );
}
