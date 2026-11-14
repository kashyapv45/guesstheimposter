# Guess The Imposter — Spec (v3)

## 1. Play mode

Pass & Play only: one phone passed around the table. Pure local React state + localStorage. No server, no accounts. Static deployment on Vercel.

## 2. UI kits (mobile-first)

- Selectable on the home screen, saved per device, applied before first paint.
- **Midnight Hi-Fi** (default): brushed obsidian `#121214`, amber glow `#F59E0B`, emerald `#10B981`, crimson imposter alert `#EF4444`.
- **Retro Vinyl**: cream `#F4EFE6`, kraft `#D8C3A5`, charcoal `#1E1E1E`, burnt orange `#D95D39`, teal `#2A9D8F`.
- **Neon Arcade**: midnight purple `#0D0221`, cyan `#00E5FF`, neon green `#39FF14`, magenta `#FF2D95`.
- Shared across kits: Fraunces (headers), Space Grotesk (body), JetBrains Mono (timers); spinning record with chrome tonearm; press-and-hold reveal (imposter label glows crimson); primary controls in the bottom 35% of the screen.

## 3. Game features

- Timer: off, discussion countdown (60–300s), or per-player clue timer (15–45s). Groove progress ring + flip-clock, crimson for the last 5s.
- Imposters auto-scale (1 for 3–5, 2 for 6–8, 3 for 9+) with manual override. 3–16 players.
- Imposter visibility: category only, related decoy word, or hardcore blind.
- Optional Mr. White: blank label, wins by guessing the word after being voted out.
- Secret pass-the-phone voting with one tie-break runoff; score tracking across rounds.

## 4. Word engine

- 15 categories, 250+ words each, 4,000+ total, in `data/categories/*.json`.
- `npm run validate-words` runs before every build: no duplicates across categories, schema, generic-word ban, decoy pairs valid, minimum counts.
- Persistent Fisher-Yates deck in localStorage: no repeats until the crate is exhausted, "N / M left" badge, reshuffle button, custom word lists.
