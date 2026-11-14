# Guess The Imposter — Spec (v2)

## 1. Multiplayer architecture (3 play modes)

| Mode | How it works | Best for |
|---|---|---|
| Online room | Host's room lives in Upstash Redis / Vercel KV (4-hour TTL), used only to pass the WebRTC handshake. Gameplay then flows peer-to-peer. | Friends on different networks / cellular |
| Local Wi-Fi | Same handshake via `/api/signal`; on one Wi-Fi the WebRTC link then runs directly over the router (sub-10ms). | Parties, one shared Wi-Fi or hotspot |
| Pass & Play | Local React state + localStorage. No network. | One phone around a table |

The whole architecture stays inside one Vercel project: no Pusher, Ably or Firebase. Vercel functions + Upstash/Vercel KV (or an in-memory store for single-process personal hosting) just pass the handshake text.


## 2. 8-character room codes

- Alphabet without 0, O, 1, I, L: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
- Shown as two blocks, `VNL7-K92P`, styled as a record catalog number (`CAT. NO. VNL7-K92P`).
- Tap to copy the join link (`/join/VNL7K92P`); flip the sleeve to show a QR code.

## 3. Midnight Hi-Fi UI (mobile-first)

- Brushed obsidian chassis `#121214`, amber vacuum-tube glow `#F59E0B`, emerald status LEDs `#10B981`, crimson imposter alert `#EF4444`; chrome tonearm over the spinning record.
- Type: Fraunces (headers), Space Grotesk (body), JetBrains Mono (codes, timers).
- Primary controls in the bottom 35% of the screen.
- Press-and-hold the spinning record label to see your word; the imposter's label glows crimson. Release hides it.
- Rocker switches: network (Pass & Play / Cloud / Local Wi-Fi), timer, imposter hint. LED: emerald = direct LAN, amber = via internet.

## 4. Game features

- Timer: off, discussion countdown (60–300s), or per-player clue timer (15–45s). Groove progress ring + flip-clock, turns crimson for the last 5s.
- Imposters auto-scale (1 for 3–5, 2 for 6–8, 3 for 9+) with manual override.
- Imposter visibility: category only, related decoy word, or hardcore blind.
- Optional Mr. White: blank label, wins by guessing the word after being voted out.
- Reconnect: each guest keeps a session token in sessionStorage; a refresh rejoins the room with the same role.

## 5. Word engine

- 15 categories, 250+ words each, 4,000+ total, in `data/categories/*.json`.
- `npm run validate-words` runs before every build: no duplicates across categories, schema, generic-word ban, decoy pairs valid, minimum counts.
- Persistent Fisher-Yates deck in localStorage: no repeats until the crate is exhausted, "N / M left" badge, reshuffle button.

## 6. Roadmap

1. Word engine & build linter: Next.js + TypeScript + Tailwind, `validate-words`, `useWordDeck`, curated JSON crates.
2. Hi-Fi UI & Pass & Play: panels, press-and-hold reveal, flip-clock timer, full single-device loop.
3. Room codes, Cloud & Local Wi-Fi: code generator + QR join link, WebRTC transport with server handshake, automatic reconnect.
