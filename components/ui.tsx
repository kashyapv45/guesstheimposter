"use client";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import QRCode from "qrcode";
import { sfx, useMuted } from "@/lib/sound";
import type { Secret } from "@/lib/game";

export function Screen({ title, kicker, children, actions }: { title: string; kicker?: string; children: ReactNode; actions?: ReactNode }) {
  const [muted, setMuted] = useMuted();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-charcoal/60">{kicker ?? "45 RPM · Side A"}</p>
          <h1 className="font-serif text-3xl font-black leading-none">{title}</h1>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          aria-pressed={muted}
          className="shrink-0 rounded-md border-2 border-charcoal bg-kraft px-2 py-1 font-mono text-[11px] font-bold uppercase"
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      </header>
      <div className="flex-1 space-y-4 py-4">{children}</div>
      {actions && (
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t-2 border-charcoal/10 bg-cream/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {actions}
        </div>
      )}
    </main>
  );
}

const BUTTON = {
  primary: "bg-orange text-cream",
  secondary: "bg-charcoal text-cream",
  ghost: "bg-kraft text-charcoal",
  teal: "bg-teal text-cream",
};

export function Button({ variant = "primary", className = "", onClick, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      {...p}
      onClick={(e) => {
        sfx.click();
        onClick?.(e);
      }}
      className={`min-h-14 w-full rounded-xl border-2 border-charcoal px-4 font-serif text-lg font-bold shadow-[0_4px_0_#1E1E1E] transition active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#1E1E1E] ${BUTTON[variant]} ${className}`}
    />
  );
}

export function Sleeve({ title, dark, children, className = "" }: { title?: string; dark?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border-2 border-charcoal p-4 shadow-[4px_4px_0_#1E1E1E] ${dark ? "bg-charcoal text-cream" : "bg-kraft"} ${className}`}>
      {title && <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em] opacity-70">{title}</h2>}
      {children}
    </section>
  );
}

export function Rocker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl border-2 border-charcoal bg-charcoal p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => {
            sfx.click();
            onChange(o.value);
          }}
          className={`min-h-11 flex-1 rounded-lg px-1 font-mono text-[11px] font-bold uppercase tracking-wider transition ${value === o.value ? "bg-mustard text-charcoal shadow-[inset_0_-3px_0_rgba(0,0,0,.25)]" : "text-cream/70"}`}
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
      onClick={() => {
        sfx.click();
        onChange(!on);
      }}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
    >
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-xs opacity-70">{hint}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-md border-2 border-charcoal ${on ? "bg-teal" : "bg-cream"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-sm border-2 border-charcoal bg-charcoal transition-all ${on ? "left-6" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Stepper({ label, value, min, max, step = 1, onChange, format = String }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const btn = "h-11 w-11 rounded-lg border-2 border-charcoal bg-cream font-mono text-xl font-bold disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <button aria-label={`Decrease ${label}`} className={btn} disabled={value <= min} onClick={() => (sfx.click(), onChange(Math.max(min, value - step)))}>
          −
        </button>
        <span className="min-w-14 text-center font-mono text-lg font-bold" aria-live="polite">{format(value)}</span>
        <button aria-label={`Increase ${label}`} className={btn} disabled={value >= max} onClick={() => (sfx.click(), onChange(Math.min(max, value + step)))}>
          +
        </button>
      </div>
    </div>
  );
}

export function Led({ color, label }: { color: "green" | "amber" | "off"; label?: string }) {
  const c = { green: "bg-[#3ddc84] shadow-[0_0_8px_#3ddc84]", amber: "bg-mustard shadow-[0_0_8px_#E9B44C]", off: "bg-charcoal/30" }[color];
  return <span role="img" aria-label={label ?? color} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c}`} />;
}

export function Vinyl({ color = "#D95D39", size = 220, spinning = true, label }: { color?: string; size?: number; spinning?: boolean; label?: ReactNode }) {
  return (
    <div className={`vinyl relative grid place-items-center rounded-full ${spinning ? "motion-safe:animate-[spin_4s_linear_infinite]" : ""}`} style={{ width: size, height: size }}>
      <div className="grid place-items-center rounded-full text-center" style={{ width: size * 0.4, height: size * 0.4, background: color }}>
        {label}
      </div>
      {!label && <div className="absolute h-2.5 w-2.5 rounded-full bg-cream" />}
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
        <p className="font-serif text-xl font-black leading-tight text-orange">You are the imposter</p>
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
    if (v) {
      sfx.needle();
      onReveal?.();
    }
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
        <Vinyl color={color} size={260} spinning={!held} label={!held && <span className="font-mono text-[10px] font-bold uppercase leading-tight text-cream">Hold<br />me</span>} />
        {held && (
          <div className="absolute inset-[12%] grid place-items-center content-center gap-1 rounded-full border-4 border-charcoal bg-cream p-4 text-center">
            <SecretText secret={secret} />
          </div>
        )}
      </button>
      <p className="font-mono text-xs uppercase tracking-widest text-charcoal/70">{held ? "Let go to hide" : "Press & hold the record"}</p>
    </div>
  );
}

// Flip-clock countdown inside a vinyl groove progress ring. Needle scratch at 5s.
export function Timer({ endAt, total, caption, onExpire }: { endAt: number | null; total: number; caption?: string; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const warned = useRef<number | null>(null);
  const fired = useRef<number | null>(null);
  useEffect(() => {
    if (endAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endAt]);
  const left = endAt == null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
  useEffect(() => {
    if (endAt == null) return;
    if (left > 0 && left <= 5 && warned.current !== endAt) {
      warned.current = endAt;
      sfx.scratch();
    }
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
          <circle cx="80" cy="80" r={r} fill="#1E1E1E" stroke="#2a2a2a" strokeWidth="14" />
          <circle cx="80" cy="80" r={r} fill="none" stroke={left <= 5 ? "#D95D39" : "#E9B44C"} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={circ * (1 - left / Math.max(1, total))} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-300" />
        </svg>
        <div className="relative flex items-center gap-0.5 font-mono text-2xl font-bold text-cream">
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
    QRCode.toDataURL(text, { margin: 1, width: size * 2, errorCorrectionLevel: "L", color: { dark: "#1E1E1E", light: "#F4EFE6" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [text, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt="QR code" className="mx-auto rounded-lg border-2 border-charcoal" />
  ) : (
    <div style={{ width: size, height: size }} className="mx-auto animate-pulse rounded-lg bg-charcoal/10" />
  );
}

export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="w-full rounded-lg border-2 border-dashed border-charcoal/50 px-3 py-2 font-mono text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
