# Guess the Imposter

Retro vinyl party game. Everyone gets the same secret word, except the imposter. Give one-word clues, then vote out the bluffer.

Three ways to play:

| Mode | How | Needs |
|---|---|---|
| **Pass & Play** | One phone passed around | Nothing. Works offline after first visit (PWA). |
| **Online** | 8-char room code (`VNL7-K92P`) or QR | Internet for the handshake. |
| **Local Wi-Fi** | Same as Online, plus an offline QR handshake | Same Wi-Fi / hotspot. No internet needed with QR. |

Online and Local Wi-Fi use the same transport: **WebRTC DataChannels** in a star around the host's phone. The server only passes the handshake text (`/api/signal/[code]`). Gameplay then runs peer-to-peer, and on the same Wi-Fi it stays on the LAN (green LED in the lobby). No Pusher, Ably or Firebase.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # game rules, deck, room codes
npm run validate-words
npm run build      # runs validate-words first
```

## Deploy to Vercel

1. Import the repo into Vercel.
2. Add an Upstash Redis (or Vercel KV) integration. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Rooms expire after 4 hours.
3. Deploy. `npm run build` runs the word validator first, so a bad word list fails the deploy.

Without those env vars the signal store is in-memory. That only works when one server process handles every request (local dev, `next start` on one machine), not on Vercel's serverless functions.

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
- Timer: off, a discussion countdown (60–300s) or a per-clue timer (15–45s). Needle scratch at 5s.

## Known limits

- STUN only, no TURN relay: a few strict mobile or corporate networks can't connect in Online mode. Add a TURN server to `ICE` in `lib/net.ts` if needed.
- The host's phone holds the game. If the host refreshes, the same tab restores the room and guests reconnect automatically. If the host closes the tab, the room ends (no host migration).
- The offline QR handshake needs the app opened once on each phone beforehand (so it's cached), and the host needs camera permission to scan replies.
