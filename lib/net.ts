"use client";
// One transport for Online and Local Wi-Fi: WebRTC DataChannels in a star around the host.
// The handshake goes through /api/signal (needs internet once) or through QR codes (no internet at all).
// Once connected, devices on the same Wi-Fi talk directly over the LAN.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Action, GameState, Secret } from "./game";
import { randomId } from "./roomCode";

export type HostMsg = { type: "state"; state: GameState; secret: Secret | null };
export type GuestMsg = { type: "hello"; token: string; name: string } | { type: "action"; action: Action };
export type GuestStatus = "idle" | "connecting" | "connected" | "reconnecting" | "missing" | "failed";

// shortcut: STUN only, no TURN relay; a few strict mobile/corporate NATs can't connect online. Add a TURN server if that bites.
const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = (code: string) => `/api/signal/${code}`;

export const pack = (sdp: string) => compressToEncodedURIComponent(sdp);
export const unpack = (s: string) => decompressFromEncodedURIComponent(s.trim()) || "";

// Non-trickle ICE: wait for candidates so one message carries the whole handshake.
async function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 3000); // no internet => STUN never answers; go with local candidates
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

function opened(dc: RTCDataChannel, ms: number) {
  if (dc.readyState === "open") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    dc.addEventListener("open", () => (clearTimeout(t), resolve()), { once: true });
  });
}

// Green LED: the selected ICE pair uses a local (host) candidate, i.e. traffic stays on the LAN.
export async function isDirectLan(pc: RTCPeerConnection): Promise<boolean> {
  const stats = await pc.getStats();
  let pairId: string | undefined;
  stats.forEach((r) => {
    if (r.type === "transport" && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId;
  });
  let pair: RTCIceCandidatePairStats | undefined;
  stats.forEach((r) => {
    if (r.type === "candidate-pair" && (pairId ? r.id === pairId : r.nominated && r.state === "succeeded")) pair = r;
  });
  if (!pair) return false;
  const local = stats.get(pair.localCandidateId);
  const remote = stats.get(pair.remoteCandidateId);
  return local?.candidateType === "host" && remote?.candidateType === "host";
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

  async register(): Promise<"ok" | "taken" | "offline"> {
    try {
      const r = await fetch(api(this.code), { method: "POST", body: JSON.stringify({ kind: "create", secret: this.secret }) });
      return r.ok ? "ok" : r.status === 409 ? "taken" : "offline";
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
        /* offline: QR handshakes still work */
      }
    };
    void poll();
    this.timer = setInterval(poll, 1500);
  }

  private async handleOffer(peer: string, sdp: string) {
    const pc = new RTCPeerConnection(ICE);
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

  lanStatus(token: string) {
    const p = this.peers.get(token);
    return p ? isDirectLan(p.pc).catch(() => false) : Promise.resolve(false);
  }

  // Offline handshake, step 1: host shows this offer as a QR (inside the join link).
  async createInvite() {
    const pc = new RTCPeerConnection(ICE);
    this.attach(pc, pc.createDataChannel("game"));
    return { pc, packed: pack(await makeOffer(pc)) };
  }

  // Offline handshake, step 3: host scans the guest's answer QR.
  async acceptInvite(pc: RTCPeerConnection, packedAnswer: string) {
    const sdp = unpack(packedAnswer);
    if (!sdp.startsWith("v=")) throw new Error("That isn't a reply code from this game.");
    await pc.setRemoteDescription({ type: "answer", sdp });
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
  private viaServer = false;
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

  async connectViaServer() {
    this.viaServer = true;
    let attempts = 0;
    while (!this.closed) {
      this.on.status(attempts++ ? "reconnecting" : "connecting");
      try {
        await this.attempt();
        return;
      } catch (e) {
        if ((e as Error).message === "missing") return this.on.status("missing");
        await sleep(2000);
      }
    }
  }

  private async attempt() {
    const pc = new RTCPeerConnection(ICE);
    const dc = pc.createDataChannel("game");
    const peer = randomId();
    try {
      const sdp = await makeOffer(pc);
      const r = await fetch(api(this.code), { method: "POST", body: JSON.stringify({ kind: "offer", peer, sdp }) });
      if (r.status === 404) throw new Error("missing");
      if (!r.ok) throw new Error("signal");
      let answer: string | null = null;
      for (let i = 0; i < 30 && !answer && !this.closed; i++) {
        await sleep(1000);
        const res = await fetch(`${api(this.code)}?peer=${peer}`, { cache: "no-store" });
        if (res.ok) answer = ((await res.json()) as { sdp: string | null }).sdp;
      }
      if (!answer) throw new Error("timeout");
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      await opened(dc, 15_000);
      this.wire(pc, dc);
    } catch (e) {
      pc.close();
      throw e;
    }
  }

  // Offline handshake, step 2: guest opened the host's QR link and shows its answer as a QR.
  async connectViaInvite(packedOffer: string): Promise<string> {
    this.on.status("connecting");
    const pc = new RTCPeerConnection(ICE);
    pc.ondatachannel = (e) => {
      opened(e.channel, 120_000).then(
        () => this.wire(pc, e.channel),
        () => this.on.status("failed"),
      );
    };
    const sdp = unpack(packedOffer);
    if (!sdp.startsWith("v=")) throw new Error("bad invite");
    return pack(await answerOffer(pc, sdp));
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
      if (this.closed) return;
      if (this.viaServer) void this.connectViaServer();
      else this.on.status("failed");
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
