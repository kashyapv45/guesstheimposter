# Project Architecture & Improvement Suggestions — Party Kit

This document tracks technical improvements, implemented features, and future recommendations for **Party Kit** (Guess the Imposter & Mafia).

---

## 1. Recently Implemented

### 1.1 Screen Wake Lock (`lib/useWakeLock.ts`)
- **Status:** **Completed**
- **Implementation:** Active in both **Pass & Play** (`app/play/page.tsx`) and **Online Rooms** (`app/room/[code]/RoomClient.tsx`).
- **Function:** Uses `navigator.wakeLock.request("screen")` with auto-reacquisition on `visibilitychange` to keep screens awake during gameplay so mobile phones don't sleep, lock, and drop WebSocket connections.

### 1.2 Mobile Haptic Feedback (`lib/haptics.ts`)
- **Status:** **Completed**
- **Implementation:**
  - **Role Reveal (`VinylReveal`):** High-intensity multi-pulse for Imposter/Mafia (`[40, 60, 40, 60, 80]`) vs. clean pulse for Crew (`35ms`).
  - **Timer Urgency (`Timer`):** Light 25ms tick per second during the final 5 seconds, followed by an ending pulse.
  - **Action Confirmation:** 20ms confirmation tap on voting and Mafia night actions.

### 1.3 Pass & Play Player Rename
- **Status:** **Completed**
- **Implementation:** Added `{ type: "rename", id, name }` action to `lib/game.ts` (with unit tests) and inline rename input (✎ / ✓ / ✕) in `app/play/page.tsx` so players can fix typos or change names between rounds without losing their color or seat.

### 1.4 Automatic Host Migration on 2-Minute Disconnect
- **Status:** **Completed**
- **Implementation:**
  - In `app/api/ably/route.ts`, the endpoint supports `claimHost=<hostSecret>`. It validates `codeFor(claimHost) === code` using the server's HMAC key, granting host capabilities to the claimant without server-side storage.
  - In `lib/useRoom.ts`, the host passes `hostKey` over authenticated private player channels (`room:${code}:p:${pid}`).
  - If the host disconnects from presence for **2 minutes (120 seconds)**, connected guests display a countdown banner. If the host does not return, a deterministic election selects the next player in seat order. That player claims host capabilities, resets the round safely to the lobby, and resumes the room.

---

## 2. Recommended Future Enhancements

### 2.1 True Host Kick & Blacklist
- **Technical Context:** A naive `dispatch({ type: "leave", id })` on the host is insufficient: the guest's tab is still connected to Ably presence, so on its next presence heartbeat or reconnect, it says hello and is seated again.
- **Proper Implementation:**
  1. Host maintains a `kicked: string[]` set in room state to reject any future `hello` or presence entry from that `clientId`.
  2. Host publishes a `{ type: "kicked" }` message to that player's private channel (`room:${code}:p:${id}`).
  3. The guest's tab listens for `"kicked"`, leaves presence, clears its session storage (`clearSession`), and navigates back to `/`.

### 2.2 QR Code on Host Screen (`CodeCard`)
- **Technical Context:** When hosting on a laptop, tablet, or TV, guests must manually enter the 8-character code.
- **Implementation:** Render a pure SVG QR code of `${location.origin}/room/${code}` inside `CodeCard` (`components/lobbies.tsx`) or in an expandable sleeve modal.

### 2.3 Clock Skew Correction via Ably Server Time
- **Technical Context:** Countdown timers compute `timerEnd - Date.now()`. If a player's device clock is skewed by 3–5 seconds from the host's device clock, their progress ring and flip-clock will show the wrong remaining time.
- **Implementation:** Call `await rt.time()` once on connection to calculate `skew = serverTime - Date.now()`. While network round-trip jitter means it is not microsecond-perfect, it eliminates multi-second phone clock drift across iOS and Android devices.

### 2.4 Late Joiner Spectator View
- **Technical Context:** When a guest joins an online room mid-round, the host's reducer seats them immediately (`p.connected = true`), but because they were not dealt into the active round, `round.roles[me]` is undefined.
- **Implementation:** Rather than showing a static "Round in progress" card in `GameView.tsx`, display the active discussion timer and the anonymized voting board in read-only mode so late arrivals can spectate until dealt in next round.

### 2.5 Procedural Web Audio Retro SFX
- **Technical Context:** To enhance the analog vinyl aesthetic without adding external audio asset bundles.
- **Implementation:** A lightweight `AudioContext` synthesizer generating vinyl needle drop crackles, tactile switch clicks, and timer ticks. Includes a mute toggle in `/settings`.
