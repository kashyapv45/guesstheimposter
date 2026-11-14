"use client";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import QRCode from "qrcode";
import type { Secret } from "@/lib/game";

export function Screen({ title, kicker, children, actions }: { title: string; kicker?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">{kicker ?? "45 RPM · Side A"}</p>
          <h1 className="font-serif text-3xl font-black leading-none">{title}</h1>
        </div>
      </header>
      <div className="flex-1 space-y-4 py-4">{children}</div>
      {actions && (
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t-2 border-edge/10 bg-chassis/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {actions}
        </div>
      )}
    </main>
  );
}

const BUTTON = {
  primary: "bg-amber text-chassis shadow-[0_0_24px_rgba(245,158,11,.25)]",
  secondary: "bg-well text-ink",
  ghost: "brushed bg-panel text-ink",
  teal: "bg-emerald text-chassis",
};

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      {...p}
      className={`min-h-14 w-full rounded-xl border-2 border-edge px-4 font-serif text-lg font-bold shadow-[0_4px_0_#000] transition active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#000] ${BUTTON[variant]} ${className}`}
    />
  );
}

export function Sleeve({ title, dark, children, className = "" }: { title?: string; dark?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border-2 border-edge p-4 shadow-[0_10px_30px_rgba(0,0,0,.55)] ${dark ? "bg-well text-ink" : "brushed bg-panel"} ${className}`}>
      {title && <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em] opacity-70">{title}</h2>}
      {children}
    </section>
  );
}

export function Rocker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl border-2 border-edge bg-well p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-lg px-1 font-mono text-[11px] font-bold uppercase tracking-wider transition ${value === o.value ? "bg-amber text-chassis shadow-[inset_0_-3px_0_rgba(0,0,0,.3),0_0_14px_rgba(245,158,11,.45)]" : "text-ink/70"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
    >
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-xs opacity-70">{hint}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-md border-2 border-edge ${on ? "bg-emerald" : "bg-field"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-sm border-2 border-edge bg-well transition-all ${on ? "left-6" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Stepper({ label, value, min, max, step = 1, onChange, format = String }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const btn = "h-11 w-11 rounded-lg border-2 border-edge bg-field font-mono text-xl font-bold disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <button aria-label={`Decrease ${label}`} className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <span className="min-w-14 text-center font-mono text-lg font-bold" aria-live="polite">{format(value)}</span>
        <button aria-label={`Increase ${label}`} className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </button>
      </div>
    </div>
  );
}

export function Led({ color, label }: { color: "green" | "amber" | "off"; label?: string }) {
  const c = { green: "bg-emerald shadow-[0_0_10px_#10B981]", amber: "bg-amber shadow-[0_0_10px_#F59E0B]", off: "bg-edge" }[color];
  return <span role="img" aria-label={label ?? color} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c}`} />;
}

export function Vinyl({ color = "#F59E0B", size = 220, spinning = true, label }: { color?: string; size?: number; spinning?: boolean; label?: ReactNode }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className={`vinyl grid h-full w-full place-items-center rounded-full ${spinning ? "motion-safe:animate-[spin_4s_linear_infinite]" : ""}`}>
        <div className="grid place-items-center rounded-full text-center shadow-[0_0_18px_rgba(0,0,0,.6)]" style={{ width: size * 0.4, height: size * 0.4, background: color }}>
          {label}
        </div>
        {!label && <div className="absolute h-2.5 w-2.5 rounded-full bg-zinc-300" />}
      </div>
      {/* chrome tonearm */}
      <div aria-hidden className="pointer-events-none absolute" style={{ right: -size * 0.04, top: -size * 0.02, width: size * 0.16, height: size * 0.62 }}>
        <div className="absolute right-0 top-0 aspect-square w-3/4 rounded-full border border-zinc-500 bg-[radial-gradient(circle_at_35%_30%,#f4f4f5,#71717a)] shadow-[0_4px_10px_rgba(0,0,0,.6)]" />
        <div className="absolute top-[12%] h-[82%] w-[9%] origin-top rotate-[22deg] rounded-full bg-gradient-to-r from-zinc-400 via-zinc-100 to-zinc-500" style={{ right: "34%" }} />
        <div className="absolute bottom-0 left-[6%] h-[11%] w-[34%] rotate-[22deg] rounded-sm bg-gradient-to-b from-zinc-200 to-zinc-500" />
      </div>
    </div>
  );
}

export function SecretText({ secret }: { secret: Secret }) {
  if (secret.role === "mrwhite")
    return (
      <>
        <p className="font-mono text-[10px] uppercase tracking-widest">Blank label</p>
        <p className="font-serif text-xl font-black">You are Mr. White</p>
        <p className="text-xs">No word, no category. Blend in. If you get caught, guess the word to win.</p>
      </>
    );
  if (secret.role === "imposter")
    return (
      <>
        <p className="font-serif text-xl font-black uppercase leading-tight text-white">Imposter alert</p>
        <p className="text-xs font-bold text-white/90">You don&apos;t know the word.</p>
        {secret.category && <p className="text-sm">Category: <b>{secret.category}</b></p>}
        {secret.word && <p className="text-sm">Decoy: <b>{secret.word}</b></p>}
        {!secret.category && !secret.word && <p className="text-xs">No hints. Good luck.</p>}
      </>
    );
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-widest">{secret.category}</p>
      <p className="font-serif text-2xl font-black leading-tight">{secret.word}</p>
    </>
  );
}

// Press-and-hold the record to peek; letting go hides it again.
export function VinylReveal({ secret, color, onReveal }: { secret: Secret; color: string; onReveal?: () => void }) {
  const [held, setHeld] = useState(false);
  const show = (v: boolean) => {
    setHeld(v);
    if (v) onReveal?.();
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        aria-label={held ? "Release to hide your word" : "Press and hold to see your word"}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          show(true);
        }}
        onPointerUp={() => show(false)}
        onPointerCancel={() => show(false)}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            show(true);
          }
        }}
        onKeyUp={() => show(false)}
        onBlur={() => held && show(false)}
        onContextMenu={(e) => e.preventDefault()}
        className="relative touch-none select-none rounded-full [-webkit-touch-callout:none]"
      >
        <Vinyl color={color} size={260} spinning={!held} label={!held && <span className="font-mono text-[10px] font-bold uppercase leading-tight text-chassis">Hold<br />me</span>} />
        {held && (
          <div className={`absolute inset-[12%] grid place-items-center content-center gap-1 rounded-full border-4 p-4 text-center ${secret.role === "imposter" ? "border-crimson bg-crimson text-white shadow-[0_0_48px_rgba(239,68,68,.8)]" : "border-amber/60 bg-field shadow-[0_0_30px_rgba(245,158,11,.25)]"}`}>
            <SecretText secret={secret} />
          </div>
        )}
      </button>
      <p className="font-mono text-xs uppercase tracking-widest text-ink/70">{held ? "Let go to hide" : "Press & hold the record"}</p>
    </div>
  );
}

// Flip-clock countdown inside a vinyl groove progress ring; turns crimson for the last 5s.
export function Timer({ endAt, total, caption, onExpire }: { endAt: number | null; total: number; caption?: string; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(null);
  useEffect(() => {
    if (endAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endAt]);
  const left = endAt == null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
  useEffect(() => {
    if (endAt == null) return;
    if (left === 0 && fired.current !== endAt) {
      fired.current = endAt;
      onExpire?.();
    }
  }, [left, endAt, onExpire]);
  if (endAt == null) return null;
  const r = 70;
  const circ = 2 * Math.PI * r;
  const digits = `${String(Math.floor(left / 60)).padStart(2, "0")}${String(left % 60).padStart(2, "0")}`;
  return (
    <div className="flex flex-col items-center gap-2" role="timer" aria-label={`${left} seconds left`}>
      <div className="relative grid h-44 w-44 place-items-center">
        <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
          <circle cx="80" cy="80" r={r} fill="#0b0b0d" stroke="#1f1f24" strokeWidth="14" />
          <circle cx="80" cy="80" r={r} fill="none" stroke={left <= 5 ? "#EF4444" : "#F59E0B"} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={circ * (1 - left / Math.max(1, total))} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-300" />
        </svg>
        <div className="relative flex items-center gap-0.5 font-mono text-2xl font-bold text-amber [text-shadow:0_0_8px_rgba(245,158,11,.7)]">
          {digits.split("").map((d, i) => (
            <span key={i} className="flex items-center">
              {i === 2 && <span className="px-0.5">:</span>}
              <span className="rounded bg-[#2b2b2b] px-1.5 py-1 shadow-[inset_0_-12px_0_rgba(255,255,255,.04)]">{d}</span>
            </span>
          ))}
        </div>
      </div>
      {caption && <p className="font-mono text-xs uppercase tracking-widest">{caption}</p>}
    </div>
  );
}

export function QR({ text, size = 240 }: { text: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: size * 2, errorCorrectionLevel: "L", color: { dark: "#121214", light: "#F5F5F4" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [text, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt="QR code" className="mx-auto rounded-lg border-2 border-edge" />
  ) : (
    <div style={{ width: size, height: size }} className="mx-auto animate-pulse rounded-lg bg-well/10" />
  );
}
