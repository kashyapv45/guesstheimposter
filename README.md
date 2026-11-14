# Guess the Imposter

Midnight Hi-Fi vinyl party game. Everyone gets the same secret word, except the imposter. Give one-word clues, then vote out the bluffer.

Two ways to play:

| Mode | How | Needs |
|---|---|---|
| **Pass & Play** | One phone passed around | Just the website |
| **Local Wi-Fi** | Everyone on their own phone, paired by QR codes | Everyone on one Wi-Fi or hotspot. No server, no setup. |

**Local Wi-Fi pairing:** the host taps *Invite a player* and shows a QR. The guest scans it with the phone camera (it opens the site with the host's connection offer in the link), enters a name and shows a reply QR. The host taps *Scan their reply*. The two phones are then joined by a **WebRTC DataChannel** directly over the Wi-Fi. One player at a time, up to 16 players. The connection offers only local network addresses (no STUN or TURN), so game traffic never leaves your Wi-Fi. There is **no backend at all**: no API routes, no database.

If a guest drops or refreshes, a "re-pair" bar appears for the host. A new invite puts the guest back in the same seat with the same role, because the seat ID is kept in the guest's tab for 1 hour.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # game rules, deck, room codes
npm run validate-words
npm run build      # runs validate-words first
```

## Deploy to Vercel

Import the repo into Vercel and deploy. No storage, environment variables or other setup needed.

## Words

`data/categories/*.json`: 15 categories, 4,000+ words, each tagged with a sub-category and difficulty (`easy`, `medium`, `spicy`). Optional curated decoys go in a `"decoys": { "Espresso": "Cappuccino" }` map. Words without one get a random sibling from the same sub-category.

`npm run validate-words` checks the schema, duplicates across all files (ignoring case and accents), overly generic words, at least 250 words per category and at least 4,000 in total.

Played words are tracked per device in `localStorage` with a persistent Fisher-Yates deck. A word won't repeat until its whole crate has been played, and each category shows a `312 / 350 left` badge plus a reshuffle button.

## Rules as implemented

- Imposters: 1 for 3–5 players, 2 for 6–8, 3 for 9+, with a manual override. The crew always outnumbers the imposters.
- Imposter hint: category, a decoy word, or hardcore (nothing).
- Mr. White (optional, 6+ players): gets a blank label. If voted out, they get one guess at the word.
- Voting: a tie triggers one runoff between the tied players. If it ties again, the imposters escape.
- Scoring: crew catch the imposter, +1 each. Imposters escape, +2 each. Mr. White guesses right, +3.
- Timer: off, a discussion countdown (60–300s) or a per-clue timer (15–45s). Ring turns crimson for the last 5s.

## Known limits

- Local Wi-Fi only: phones must share one Wi-Fi or hotspot. Guest networks with client isolation block phone-to-phone traffic.
- The host needs camera permission to scan reply QRs. Without a camera, the guest can copy the reply code and the host pastes it.
- The host's phone holds the game. If the host refreshes, the same tab restores the room and everyone re-pairs with a new invite. Sessions end after 1 hour without play.
