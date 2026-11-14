# Guess the Imposter

A pass-and-play party game on one phone. Everyone gets the same secret word, except the imposter. Pass the phone so each player can press-and-hold the record to peek at their word, give one-word clues, then vote out the bluffer.

No accounts, no server, no setup: a static Next.js site.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # game rules and word deck
npm run validate-words
npm run build      # runs validate-words first
```

## Deploy to Vercel

Import the repo into Vercel and deploy. Nothing else to configure.

## UI kits

The home screen has a **UI kit** picker; the choice is saved on the device.

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

Each kit sets its own fonts, corner radius, border width, shadows, page background, panel texture and wording (e.g. *Roll tape*, *Drop the beat*). Display fonts aren't preloaded, so a phone only downloads its kit's font.

Components only use theme tokens (`chassis`, `panel`, `well`, `ink`, `amber`, `--radius`, `--bw`, `--card-shadow`, …). To add a kit: a `[data-theme="<id>"]` block in `app/globals.css`, an entry in `THEMES` in `lib/theme.ts`, and (optionally) its own object in `components/kit.tsx`. Vinyl kits fall back to the record.

## Words

`data/categories/*.json`: 15 categories, 4,000+ words, each tagged with a sub-category and difficulty (`easy`, `medium`, `spicy`). Optional curated decoys go in a `"decoys": { "Espresso": "Cappuccino" }` map. Words without one get a random sibling from the same sub-category.

`npm run validate-words` checks the schema, duplicates across all files (ignoring case and accents), overly generic words, at least 250 words per category and at least 4,000 in total.

Played words are tracked per device in `localStorage` with a persistent Fisher-Yates deck. A word won't repeat until its whole crate has been played, and each category shows a `312 / 350 left` badge plus a reshuffle button. You can also add your own word lists.

## Rules as implemented

- 3 to 16 players. Imposters: 1 for 3–5 players, 2 for 6–8, 3 for 9+, with a manual override. The crew always outnumbers the imposters.
- Imposter hint: category, a decoy word, or hardcore (nothing).
- Mr. White (optional, 6+ players): gets a blank label. If voted out, they get one guess at the word.
- Secret pass-the-phone voting. A tie triggers one runoff between the tied players. If it ties again, the imposters escape.
- Scoring: crew catch the imposter, +1 each. Imposters escape, +2 each. Mr. White guesses right, +3.
- Timer: off, a discussion countdown (60–300s) or a per-clue timer (15–45s). The ring turns crimson for the last 5s.
