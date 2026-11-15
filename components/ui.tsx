"use client";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Secret } from "@/lib/game";
import { useTheme } from "@/lib/theme";
import { HeroObject } from "./kit";

export function Screen({ title, kicker, children, actions, corner }: { title: string; kicker?: string; children: ReactNode; actions?: ReactNode; corner?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">{kicker ?? "45 RPM · Side A"}</p>
          <h1 className="font-serif text-3xl font-black leading-none">{title}</h1>
        </div>
        {corner}
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
  primary: "bg-amber text-on-accent shadow-[0_0_24px_rgb(var(--glow)/.25)]",
  secondary: "bg-well text-well-ink",
  ghost: "brushed bg-panel text-ink",
  teal: "bg-emerald text-on-accent",
};

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      {...p}
      className={`min-h-14 w-full rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge px-4 font-serif text-lg font-bold shadow-[var(--btn-shadow)] transition active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[var(--btn-shadow)] ${BUTTON[variant]} ${className}`}
    />
  );
}

export function Sleeve({ title, dark, children, className = "" }: { title?: string; dark?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius)] border-[length:var(--bw)] border-edge p-4 shadow-[var(--card-shadow)] ${dark ? "bg-well text-well-ink" : "brushed bg-panel"} ${className}`}>
      {title && <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em] opacity-70">{title}</h2>}
      {children}
    </section>
  );
}

export function Rocker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-well p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-[var(--radius-sm)] px-1 font-mono text-[11px] font-bold uppercase tracking-wider transition ${value === o.value ? "bg-amber text-on-accent shadow-[inset_0_-3px_0_rgba(0,0,0,.3),0_0_14px_rgb(var(--glow)/.45)]" : "text-well-ink/70"}`}
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
      <span className={`relative h-8 w-14 shrink-0 rounded-md border-[length:var(--bw)] border-edge ${on ? "bg-emerald" : "bg-field"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-sm border-[length:var(--bw)] border-edge bg-well transition-all ${on ? "left-6" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Stepper({ label, value, min, max, step = 1, onChange, format = String }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const btn = "h-11 w-11 rounded-[var(--radius-sm)] border-[length:var(--bw)] border-edge bg-field font-mono text-xl font-bold disabled:opacity-30";
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

export function SecretText({ secret }: { secret: Secret }) {
  if (secret.role === "imposter")
    return (
      <>
        <p className="font-serif text-xl font-black uppercase leading-tight text-white">Imposter alert</p>
        <p className="text-xs font-bold text-white/90">You don&apos;t know the word.</p>
        {secret.category && <p className="text-sm">Category: <b>{secret.category}</b></p>}
      </>
    );
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-widest">{secret.category}</p>
      <p className="font-serif text-2xl font-black leading-tight">{secret.word}</p>
    </>
  );
}

// Press-and-hold the kit's object (record, sticker, reel, pad…) to peek; letting go hides it again.
// `content` + `alert` let other games (Mafia) reuse the reveal with their own card.
export function VinylReveal({ secret, color, onReveal, content, alert }: { secret?: Secret | null; color: string; onReveal?: () => void; content?: ReactNode; alert?: boolean }) {
  const isAlert = alert ?? secret?.role === "imposter";
  const [held, setHeld] = useState(false);
  const [theme] = useTheme();
  const round = theme.shape === "round";
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
        className={`relative touch-none select-none [-webkit-touch-callout:none] ${round ? "rounded-full" : "rounded-[var(--radius)]"}`}
      >
        <HeroObject color={color} size={260} spinning={!held} label={!held && <span className="font-mono text-[10px] font-bold uppercase leading-tight">Hold<br />me</span>} />
        {held && (
          <div className={`absolute grid place-items-center content-center gap-1 border-4 p-4 text-center ${round ? "inset-[12%] rounded-full" : "inset-[4%] rounded-[var(--radius)]"} ${isAlert ? "border-crimson bg-crimson text-white shadow-[0_0_48px_rgba(239,68,68,.8)]" : "border-amber/60 bg-field shadow-[0_0_30px_rgb(var(--glow)/.25)]"}`}>
            {content ?? (secret && <SecretText secret={secret} />)}
          </div>
        )}
      </button>
      <p className="font-mono text-xs uppercase tracking-widest text-ink/70">{held ? "Let go to hide" : `Press & hold the ${theme.noun}`}</p>
      {/* What the word means (crew only), shown only while held so neighbours can't read it. */}
      {held && secret?.role === "crew" && secret.desc && (
        <div className="w-full max-w-sm rounded-[var(--radius)] border-[length:var(--bw)] border-edge bg-panel p-3 text-left shadow-[var(--card-shadow)]">
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">What is it?</p>
          <p className="text-sm leading-snug">{secret.desc}</p>
        </div>
      )}
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
          <circle cx="80" cy="80" r={r} fill="none" style={{ stroke: left <= 5 ? "var(--crimson)" : "var(--amber)" }} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={circ * (1 - left / Math.max(1, total))} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-300" />
        </svg>
        <div className="relative flex items-center gap-0.5 font-mono text-2xl font-bold text-amber [text-shadow:0_0_8px_rgb(var(--glow)/.7)]">
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

// Bottom sheet asking to confirm leaving a game (used by the back button).
export function ConfirmSheet({ open, title, body, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; body?: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={onCancel}>
      <div className="w-full max-w-md space-y-3 rounded-[var(--radius)] border-[length:var(--bw)] border-edge bg-chassis p-4 shadow-[var(--card-shadow)]" onClick={(e) => e.stopPropagation()}>
        <p className="font-serif text-xl font-bold">{title}</p>
        {body && <p className="text-sm opacity-80">{body}</p>}
        <Button onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="secondary" autoFocus onClick={onCancel}>
          Keep playing
        </Button>
      </div>
    </div>
  );
}
