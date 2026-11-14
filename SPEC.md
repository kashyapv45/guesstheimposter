# Guess The Imposter — Spec (v2)

## 1. Play modes

| Mode | How it works | Best for |
|---|---|---|
| Local Wi-Fi | QR pairing: host invite QR (lz-string compressed WebRTC offer) → guest reply QR (answer) → LAN-only WebRTC DataChannel (no STUN/TURN). No server at all. Up to 16 players. | Parties, everyone on one Wi-Fi or hotspot |
| Pass & Play | Local React state + localStorage. | One phone around a table |

Fully static on Vercel: no API routes, no database, no third-party realtime service.

## 2. Room identity

- Each room gets an 8-character catalog number (`VNL7-K92P`, alphabet without 0, O, 1, I, L), shown on the host's sleeve and in the invite link.
- Joining is by QR pairing, not by typing the code.

## 3. Midnight Hi-Fi UI (mobile-first)

- Brushed obsidian chassis `#121214`, amber vacuum-tube glow `#F59E0B`, emerald status LEDs `#10B981`, crimson imposter alert `#EF4444`; chrome tonearm over the spinning record.
- Type: Fraunces (headers), Space Grotesk (body), JetBrains Mono (codes, timers).
- Primary controls in the bottom 35% of the screen.
- Press-and-hold the spinning record label to see your word; the imposter's label glows crimson. Release hides it.
- Rocker switches: mode (Pass & Play / Local Wi-Fi), timer, imposter hint. Emerald LED = player connected on the Wi-Fi.

## 4. Game features

- Timer: off, discussion countdown (60–300s), or per-player clue timer (15–45s). Groove progress ring + flip-clock, turns crimson for the last 5s.
- Imposters auto-scale (1 for 3–5, 2 for 6–8, 3 for 9+) with manual override.
- Imposter visibility: category only, related decoy word, or hardcore blind.
- Optional Mr. White: blank label, wins by guessing the word after being voted out.
- Sessions: host room and guest seat live in sessionStorage and expire after 1 hour without play. A dropped guest re-pairs with a new invite and keeps their seat and role. Hosting a new room replaces the old one.

## 5. Word engine

- 15 categories, 250+ words each, 4,000+ total, in `data/categories/*.json`.
- `npm run validate-words` runs before every build: no duplicates across categories, schema, generic-word ban, decoy pairs valid, minimum counts.
- Persistent Fisher-Yates deck in localStorage: no repeats until the crate is exhausted, "N / M left" badge, reshuffle button.

## 6. Roadmap

1. Word engine & build linter: Next.js + TypeScript + Tailwind, `validate-words`, `useWordDeck`, curated JSON crates.
2. Hi-Fi UI & Pass & Play: panels, press-and-hold reveal, flip-clock timer, full single-device loop.
3. Local Wi-Fi: QR pairing (invite + reply), LAN-only WebRTC, re-pairing keeps seats, 1-hour session expiry.
