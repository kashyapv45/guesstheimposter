# Party Kit

Party games for one table, on phones:

| Game | Players | How |
|---|---|---|
| **Guess the Imposter** | 3–16 | Everyone gets the same secret word except the imposter. One-word clues, then vote. Pass & Play on one phone, or online with a room code. Crew see a one-line description of their word. |
| **Mafia** | 4–16 | Secret roles (Mafia, Doctor, Detective, Villagers). Night actions in secret on each phone, morning news, day discussion and vote. Online with a room code; the app is the moderator. |

Online rooms run on **PartyKit**: a small room server (`party/server.ts`) holds each room's game, runs the rules and sends every phone only what that player may see. Phones connect over WebSockets with an 8-character room code (`VNL7-K92P`) and reconnect on their own.

## Run

```bash
npm install
npm run party:dev  # room server on localhost:1999 (needed for online rooms)
npm run dev        # http://localhost:3000
npm test           # Imposter + Mafia rules, word deck
npm run build      # runs validate-words first
```

## Deploy

1. **Room server (once, then after server changes):** `npx partykit login`, then `npm run party:deploy`. It prints the host, e.g. `guess-the-imposter.<you>.partykit.dev`.
2. **Vercel:** Project → Settings → Environment Variables → `NEXT_PUBLIC_PARTYKIT_HOST` = that host. Redeploy.

Pass & Play works without the room server. Without the variable, online rooms show "Online play isn't set up".

## Word descriptions

Crew players see a one-line description under their word. Hand-written ones go in a category file's `"notes": { "Okapi": "…" }` map (checked by the validator) and always win; otherwise the host's phone looks the word up on Wikipedia, steered by the category, caches it, and gives up after 2.5s. The imposter never sees it.

## UI kits

**Settings** (⚙ on the home screen) has the **UI kit** picker; the choice is saved on the device.

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
