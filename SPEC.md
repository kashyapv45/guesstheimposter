# Party Kit — Spec (v4)

## 1. Games and modes

- **Guess the Imposter:** Pass & Play (one phone) or online room. Crew see a one-line description of their word (hand-written note, else Wikipedia lookup).
- **Mafia:** online room only. Roles: Mafia (1 for 4–5 players, 2 for 6–8, 3 for 9+, override), optional Doctor and Detective, Villagers. Night: mafia pick a target (plurality, seat-order tiebreak), doctor saves, detective checks. Morning report, day discussion (optional timer), vote (tie or "skip" = nobody). Town wins when no mafia remain; mafia win when they equal the town. Optional role reveal on death.
- **Online rooms:** PartyKit room server per 8-character code; server-authoritative rules, per-player redacted views, automatic reconnect, seat kept in the tab for 1 hour.
- Home is the Party Kit hub; the UI kit picker lives in Settings.

## 2. UI kits (mobile-first)

Selectable on the home screen, saved per device, applied before first paint. Each kit has its own palette, display font, corner radius, border weight, shadows, background/texture, wording, and a signature object used as the home hero and the press-and-hold reveal. The vinyl record only appears in vinyl kits.

| Kit | Signature object (home hero + press-and-hold reveal) | Look |
|---|---|---|
| 1970s Crate Digger | Black record, cream paper label, ink-stamp ring | Cream paper, kraft cards, burnt orange + mustard, Fraunces serif |
| Midnight Hi-Fi (default) | Record with chrome tonearm | Brushed obsidian, amber glow, emerald/crimson LEDs |
| Neo-Brutalist Zine | Tilted halftone sticker | 3px black borders, hard offset shadows, mustard/coral, Archivo Black |
| 80s Tokyo City Pop | Glossy square album: sunset, striped sun, chrome grid, colour obi | Pastel turquoise + sunset coral, gloss, Righteous |
| 50s Diner Jukebox | Cherry-red 45 with chrome rim | Checkerboard trim, chrome cards, neon turquoise, Bungee |
| Motown Master Tape | Twin reel-to-reel spools with a studio label | Walnut woodgrain, brass, Fraunces |
| 90s MPC & Wax | Sampler with green LCD and 4×4 pads | Matte black, LCD green, stencil orange, Black Ops One |
| 60s Acid Folk | Swirling marbled record | Tangerine / avocado / plum blocks, Shrikhand |

Shared across kits: press-and-hold reveal (imposter panel glows crimson), primary controls in the bottom 35% of the screen.

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
