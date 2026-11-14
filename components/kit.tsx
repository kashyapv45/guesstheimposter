"use client";
// Each UI kit's signature object: the home-screen hero and the thing you press-and-hold to see your word.
// Vinyl kits get a record; the others get their own object.
import type { ReactNode } from "react";
import { useTheme, type ThemeId } from "@/lib/theme";

type Props = { size: number; spinning?: boolean; label?: ReactNode; color?: string };
const SPIN = "motion-safe:animate-[spin_4s_linear_infinite]";

export function HeroObject(p: Props) {
  const [theme] = useTheme();
  switch (theme.id) {
    case "zine":
      return <Sticker {...p} />;
    case "citypop":
      return <AlbumArt {...p} />;
    case "motown":
      return <Reels {...p} />;
    case "mpc":
      return <Sampler {...p} />;
    default:
      return <Record kit={theme.id} {...p} />;
  }
}

const DISC: Partial<Record<ThemeId, string>> = { diner: "disc-diner", psych: "disc-psych" };

function Record({ kit, size, spinning = true, label, color = "var(--amber)" }: Props & { kit: ThemeId }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className={`${DISC[kit] ?? "vinyl"} grid h-full w-full place-items-center rounded-full ${spinning ? SPIN : ""}`}>
        <div
          className={`grid place-items-center rounded-full text-center text-on-accent shadow-[0_0_18px_rgba(0,0,0,.45)] ${kit === "crate" ? "label-paper" : ""}`}
          style={{ width: size * (kit === "diner" ? 0.34 : 0.4), height: size * (kit === "diner" ? 0.34 : 0.4), background: color }}
        >
          {label ?? (kit === "diner" ? <span className="font-serif text-lg">45</span> : null)}
        </div>
        {!label && kit !== "diner" && <div className="absolute h-2.5 w-2.5 rounded-full bg-zinc-300" />}
      </div>
      {kit === "hifi" && <Tonearm size={size} />}
    </div>
  );
}

function Tonearm({ size }: { size: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute" style={{ right: -size * 0.04, top: -size * 0.02, width: size * 0.16, height: size * 0.62 }}>
      <div className="absolute right-0 top-0 aspect-square w-3/4 rounded-full border border-zinc-500 bg-[radial-gradient(circle_at_35%_30%,#f4f4f5,#71717a)] shadow-[0_4px_10px_rgba(0,0,0,.6)]" />
      <div className="absolute top-[12%] h-[82%] w-[9%] origin-top rotate-[22deg] rounded-full bg-gradient-to-r from-zinc-400 via-zinc-100 to-zinc-500" style={{ right: "34%" }} />
      <div className="absolute bottom-0 left-[6%] h-[11%] w-[34%] rotate-[22deg] rounded-sm bg-gradient-to-b from-zinc-200 to-zinc-500" />
    </div>
  );
}

function Sticker({ size, spinning = true, label, color = "var(--amber)" }: Props) {
  const s = size * 0.84;
  return (
    <div className="grid place-items-center" style={{ width: size, height: size }}>
      <div className={`zine-sticker grid place-items-center ${spinning ? "motion-safe:animate-[wobble_2.4s_ease-in-out_infinite]" : ""}`} style={{ width: s, height: s, backgroundColor: color }}>
        <div className="grid place-items-center border-[3px] border-[#111] bg-white px-3 py-2 text-center text-[#111] shadow-[4px_4px_0_#111]" style={{ minWidth: s * 0.5 }}>
          {label ?? <span className="font-serif text-2xl">★</span>}
        </div>
      </div>
    </div>
  );
}

function AlbumArt({ size, spinning = true, label, color = "var(--emerald)" }: Props) {
  const s = size * 0.88;
  return (
    <div className="grid place-items-center" style={{ width: size, height: size }}>
      <div className={`citypop-art relative overflow-hidden ${spinning ? "motion-safe:animate-[float_4s_ease-in-out_infinite]" : ""}`} style={{ width: s, height: s }}>
        <div className="citypop-sun absolute left-1/2 top-[22%] -translate-x-1/2 rounded-full" style={{ width: s * 0.46, height: s * 0.46 }} />
        <div className="citypop-sea absolute inset-x-0 bottom-0 h-[34%]" />
        {/* obi strip in the player's colour */}
        <div className="absolute inset-y-0 left-0 w-[10%]" style={{ background: color }} />
        <div className="citypop-gloss absolute inset-0" />
        {label && (
          <div className="absolute inset-x-0 bottom-[9%] grid place-items-center">
            <div className="rounded-full bg-white/85 px-3 py-1 text-center text-[#1f3a5f] shadow">{label}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Reels({ size, spinning = true, label, color = "var(--amber)" }: Props) {
  const r = size * 0.4;
  const pad = size * 0.06;
  return (
    <div className="motown-deck relative" style={{ width: size, height: size * 0.8 }}>
      {[0, 1].map((i) => (
        <div key={i} className={`motown-reel absolute ${spinning ? SPIN : ""}`} style={{ width: r, height: r, top: pad, left: i ? size - r - pad : pad }} />
      ))}
      {/* tape running between the reels */}
      <div className="absolute h-[3px] bg-[#1a110b]" style={{ top: pad + r * 0.92, left: pad + r * 0.5, right: pad + r * 0.5 }} />
      <div className="motown-label absolute inset-x-[14%] bottom-[7%] grid min-h-[22%] place-items-center px-2 py-1 text-center" style={{ borderTop: `6px solid ${color}` }}>
        {label ?? <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Master · Take 1</span>}
      </div>
    </div>
  );
}

function Sampler({ size, spinning = true, label, color = "var(--amber)" }: Props) {
  return (
    <div className="mpc-body grid gap-[4%] p-[6%]" style={{ width: size, height: size, gridTemplateRows: "22% 1fr" }}>
      <div className="mpc-lcd grid place-items-center px-2 text-center font-mono text-[11px] uppercase leading-tight">{label ?? "SEQ 01 · 90 BPM"}</div>
      <div className="grid grid-cols-4 gap-[6%]">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className={`mpc-pad ${i === 12 && spinning ? "motion-safe:animate-pulse" : ""}`} style={i === 12 ? { background: color } : undefined} />
        ))}
      </div>
    </div>
  );
}
