"use client";
// Local Wi-Fi play: WebRTC DataChannels in a star around the host's phone.
// The join handshake (a few KB of text) goes through /api/signal. The connection itself uses no
// ICE servers, so only local network addresses are offered: the game runs directly over the shared
// Wi-Fi or hotspot, or doesn't connect at all. It never goes through the internet.
import type { Action, GameState, Secret } from "./game";
import { randomId } from "./roomCode";

export type HostMsg = { type: "state"; state: GameState; secret: Secret | null };
export type GuestMsg = { type: "hello"; token: string; name: string } | { type: "action"; action: Action };
export type GuestStatus = "idle" | "connecting" | "connected" | "reconnecting" | "missing" | "nostore" | "lanfail";

const LAN_ONLY: RTCConfiguration = { iceServers: [] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = (code: string) => `/api/signal/${code}`;

// Non-trickle ICE: wait for candidates so one message carries the whole handshake.
async function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 3000);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

async function makeOffer(pc: RTCPeerConnection) {
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return pc.localDescription!.sdp;
}

async function answerOffer(pc: RTCPeerConnection, sdp: string) {
  await pc.setRemoteDescription({ type: "offer", sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return pc.localDescription!.sdp;
}

// Resolves when the channel opens; rejects if the phones can't reach each other on the local network.
function opened(pc: RTCPeerConnection, dc: RTCDataChannel, ms: number) {
  if (dc.readyState === "open") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const fail = () => {
      clearTimeout(t);
      reject(new Error("lanfail"));
    };
    const t = setTimeout(fail, ms);
    dc.addEventListener("open", () => (clearTimeout(t), resolve()), { once: true });
    pc.addEventListener("iceconnectionstatechange", () => {
      if (pc.iceConnectionState === "failed") fail();
    });
  });
}

// Ends a room on the server (best effort; it also expires on its own after 1 hour idle).
export function closeRoom(code: string, secret: string) {
  void fetch(api(code), { method: "POST", body: JSON.stringify({ kind: "close", secret }), keepalive: true }).catch(() => {});
}

type HostEvents = {
  hello(token: string, name: string): void;
  action(token: string, action: Action): void;
  leave(token: string): void;
};

export class HostNet {
  private peers = new Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  readonly code: string;
  private secret: string;
  private on: HostEvents;

  constructor(code: string, secret: string, on: HostEvents) {
    this.code = code;
    this.secret = secret;
    this.on = on;
  }

  async register(): Promise<"ok" | "taken" | "nostore" | "offline"> {
    try {
      const r = await fetch(api(this.code), { method: "POST", body: JSON.stringify({ kind: "create", secret: this.secret }) });
      return r.ok ? "ok" : r.status === 409 ? "taken" : r.status === 503 ? "nostore" : "offline";
    } catch {
      return "offline";
    }
  }

  startPolling() {
    this.closed = false; // React dev mode closes and restarts effects
    const poll = async () => {
      try {
        const r = await fetch(`${api(this.code)}?secret=${this.secret}`, { cache: "no-store" });
        if (!r.ok) return;
        const { offers } = (await r.json()) as { offers: Record<string, string> };
        for (const [peer, sdp] of Object.entries(offers)) void this.handleOffer(peer, sdp);
      } catch {
        /* network blip: next poll retries */
      }
    };
    void poll();
    this.timer = setInterval(poll, 1500);
  }

  private async handleOffer(peer: string, sdp: string) {
    const pc = new RTCPeerConnection(LAN_ONLY);
    pc.ondatachannel = (e) => this.attach(pc, e.channel);
    const answer = await answerOffer(pc, sdp);
    await fetch(api(this.code), { method: "POST", body: JSON.stringify({ kind: "answer", secret: this.secret, peer, sdp: answer }) });
    setTimeout(() => pc.connectionState !== "connected" && !this.has(pc) && pc.close(), 60_000);
  }

  private has(pc: RTCPeerConnection) {
    return [...this.peers.values()].some((p) => p.pc === pc);
  }

  private attach(pc: RTCPeerConnection, dc: RTCDataChannel) {
    let token: string | null = null;
    dc.onmessage = (e) => {
      let msg: GuestMsg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "hello" && typeof msg.token === "string" && typeof msg.name === "string" && !token) {
        token = msg.token.slice(0, 40);
        const old = this.peers.get(token);
        if (old && old.pc !== pc) old.pc.close();
        this.peers.set(token, { pc, dc });
        this.on.hello(token, msg.name);
      } else if (msg.type === "action" && token && msg.action && typeof msg.action === "object") {
        this.on.action(token, msg.action);
      }
    };
    dc.onclose = () => {
      if (token && this.peers.get(token)?.dc === dc) {
        this.peers.delete(token);
        if (!this.closed) this.on.leave(token);
      }
    };
  }

  send(token: string, msg: HostMsg) {
    const p = this.peers.get(token);
    if (p?.dc.readyState === "open") p.dc.send(JSON.stringify(msg));
  }

  close() {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
  }
}

type GuestEvents = { message(m: HostMsg): void; status(s: GuestStatus): void };

export class GuestNet {
  private dc: RTCDataChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private closed = false;
  private code: string;
  private token: string;
  private name: string;
  private on: GuestEvents;

  constructor(code: string, token: string, name: string, on: GuestEvents) {
    this.code = code;
    this.token = token;
    this.name = name;
    this.on = on;
  }

  async connect() {
    let attempts = 0;
    while (!this.closed) {
      this.on.status(attempts++ ? "reconnecting" : "connecting");
      try {
        await this.attempt();
        return;
      } catch (e) {
        const why = (e as Error).message;
        if (why === "missing" || why === "nostore" || why === "lanfail") return this.on.status(why);
        await sleep(2000);
      }
    }
  }

  private async attempt() {
    const pc = new RTCPeerConnection(LAN_ONLY);
    const dc = pc.createDataChannel("game");
    const peer = randomId();
    try {
      const sdp = await makeOffer(pc);
      const r = await fetch(api(this.code), { method: "POST", body: JSON.stringify({ kind: "offer", peer, sdp }) });
      if (r.status === 404) throw new Error("missing");
      if (r.status === 503) throw new Error("nostore");
      if (!r.ok) throw new Error("signal");
      let answer: string | null = null;
      for (let i = 0; i < 30 && !answer && !this.closed; i++) {
        await sleep(1000);
        const res = await fetch(`${api(this.code)}?peer=${peer}`, { cache: "no-store" });
        if (res.ok) answer = ((await res.json()) as { sdp: string | null }).sdp;
      }
      if (!answer) throw new Error("timeout");
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      await opened(pc, dc, 15_000);
      this.wire(pc, dc);
    } catch (e) {
      pc.close();
      throw e;
    }
  }

  private wire(pc: RTCPeerConnection, dc: RTCDataChannel) {
    this.pc = pc;
    this.dc = dc;
    dc.onmessage = (e) => {
      try {
        this.on.message(JSON.parse(e.data));
      } catch {
        /* ignore junk */
      }
    };
    dc.onclose = () => {
      if (!this.closed) void this.connect();
    };
    dc.send(JSON.stringify({ type: "hello", token: this.token, name: this.name } satisfies GuestMsg));
    this.on.status("connected");
  }

  send(action: Action) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify({ type: "action", action } satisfies GuestMsg));
  }

  close() {
    this.closed = true;
    this.pc?.close();
  }
}
