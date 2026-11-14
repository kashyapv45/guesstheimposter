"use client";
import { useSyncExternalStore } from "react";

// Synthesized SFX (no audio files): click, needle drop, needle scratch.
let ctx: AudioContext | null = null;
let muted = typeof window !== "undefined" && localStorage.getItem("imposter:muted") === "1";
const listeners = new Set<() => void>();

function audio() {
  if (muted || typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(dur: number, freq: number, type: BiquadFilterType, gain: number, sweepTo?: number) {
  const c = audio();
  if (!c) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

function thump(freq: number, dur: number, gain: number) {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export const sfx = {
  click: () => noise(0.03, 2500, "highpass", 0.12),
  needle: () => {
    thump(70, 0.2, 0.25);
    noise(0.5, 1500, "bandpass", 0.06);
  },
  scratch: () => noise(0.35, 300, "bandpass", 0.4, 3500),
};

function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("imposter:muted", m ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const m = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => muted,
    () => false,
  );
  return [m, setMuted];
}
