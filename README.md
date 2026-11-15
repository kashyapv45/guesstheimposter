# Party Kit

Party games for one table, on phones:

| Game | Players | How |
|---|---|---|
| **Guess the Imposter** | 3–16 | Everyone gets the same secret word except the imposter. One-word clues, then vote. Pass & Play on one phone, or online with a room code. Crew see a one-line description of their word. |
| **Mafia** | 4–16 | Secret roles (Mafia, Doctor, Detective, Villagers). Night actions in secret on each phone, morning news, day discussion and vote. Online with a room code; the app is the moderator. |

Online rooms run on **Ably** (realtime WebSockets, free tier). The host's phone runs the game and sends every player only their own view over a private channel. A small Vercel route (`/api/ably`) hands out locked-down Ably passes: guests can only write to the room and read their own channel, and the room code is derived from the host's secret so nobody else can run that room. Phones reconnect on their own; a host refresh restores the room.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Imposter + Mafia rules, word deck
npm run build      # runs validate-words first
```

## Deploy

1. Create a free account at ably.com → create an app → **API Keys** → copy the key that has all capabilities (it looks like `xxxx.yyyy:zzzz`).
2. Vercel → Project → Settings → Environment Variables → `ABLY_API_KEY` = that key (keep it server-only; don't prefix it with NEXT_PUBLIC). Redeploy.
3. For local online play, put the same line in `.env.local`.

Pass & Play works without a key. Without it, online rooms show "Online play isn't set up".

## Word descriptions

Crew players see a short description of their word (a "What is it?" card while holding the record). They live in each category file's `"notes"` map: every medium and spicy word has one (2,926 total), checked by the validator. The imposter never sees it.

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

`data/categories/*.json`: 15 categories, 4,000+ words, each tagged with a sub-category and difficulty (`easy`, `medium`, `spicy`).

`npm run validate-words` checks the schema, duplicates across all files (ignoring case and accents), overly generic words, at least 250 words per category and at least 4,000 in total.

Played words are tracked per device in `localStorage` with a persistent Fisher-Yates deck. A word won't repeat until its whole crate has been played, and each category shows a `312 / 350 left` badge plus a reshuffle button.

## Guess the Imposter rules

- 3 to 16 players: everyone is **crew** except the **imposter(s)**. Imposters: 1 for 3–5 players, 2 for 6–8, 3 for 9+, with a manual override. The crew always outnumbers the imposters.
- Crew see the secret word (plus a one-line description). Imposters see only the category.
- Give one-word clues, then vote. Voting out an imposter: crew win. Voting out a crew member, or a second tie after one runoff: imposters win.
- Online, the vote waits for everyone dealt in; the host can "Count the votes now" if someone left.
- Optional timer: a discussion countdown (60–300s) or a per-clue timer (15–45s).
