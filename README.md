# Guess the Imposter

Midnight Hi-Fi vinyl party game. Everyone gets the same secret word, except the imposter. Give one-word clues, then vote out the bluffer.

Three ways to play:

| Mode | How | Needs |
|---|---|---|
| **Pass & Play** | One phone passed around | Just the website |
| **Cloud** | 8-char room code (`VNL7-K92P`) or QR link | Internet + a Redis store on the server |
| **Local Wi-Fi** | Same as Cloud; on one Wi-Fi the phones then talk directly over the router | Same as Cloud |

Online and Local Wi-Fi use the same transport: **WebRTC DataChannels** in a star around the host's phone. The server only passes the handshake text (`/api/signal/[code]`). Gameplay then runs peer-to-peer, and on the same Wi-Fi it stays on the LAN (emerald LED in the lobby; amber = via internet). No Pusher, Ably or Firebase.

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
2. **Required for Cloud / online rooms:** Project → Storage → connect **Upstash Redis** (sets `KV_REST_API_URL` + `KV_REST_API_TOKEN`) or **Redis** (sets `REDIS_URL`). Either works. Rooms expire after 4 hours.
3. **Redeploy** after connecting storage, since environment variables only apply to new deployments.

Without a store, the host screen says "Online rooms aren't set up on this server yet" instead of guests getting "Room not found". Pass & Play still works. The in-memory fallback is only for local dev or `next start` on one machine.

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

- STUN only, no TURN relay: a few strict mobile or corporate networks can't connect in Online mode. Add a TURN server to `ICE` in `lib/net.ts` if needed.
- The host's phone holds the game. If the host refreshes, the same tab restores the room and guests reconnect automatically. If the host closes the tab, the room ends (no host migration).
