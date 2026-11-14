"use client";
// Local Wi-Fi play with no server: WebRTC DataChannels in a star around the host's phone,
// paired by QR codes. Host shows an invite QR (compressed offer) -> guest's camera opens the link,
// guest shows a reply QR (compressed answer) -> host scans it -> phones talk directly over the Wi-Fi.
// No ICE servers: only local network addresses are offered, so traffic never leaves the Wi-Fi/hotspot.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Action, GameState, Secret } from "./game";

export type HostMsg = { type: "state"; state: GameState; secret: Secret | null };
export type GuestMsg = { type: "hello"; token: string; name: string } | { type: "action"; action: Action };
export type GuestStatus = "idle" | "pairing" | "connected" | "lost" | "failed";

const LAN_ONLY: RTCConfiguration = { iceServers: [] };

const pack = (sdp: string) => compressToEncodedURIComponent(sdp);
const unpack = (s: string) => decompressFromEncodedURIComponent(s.trim()) || "";

// Non-trickle ICE: wait for local candidates so one QR carries the whole handshake.
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

type HostEvents = {
  hello(token: string, name: string): void;
  action(token: string, action: Action): void;
  leave(token: string): void;
};

export class HostNet {
  private peers = new Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel }>();
  private closed = false;
  private on: HostEvents;

  constructor(on: HostEvents) {
    this.on = on;
  }

  // Step 1: a fresh offer for one guest, packed for the invite QR.
  async createInvite() {
    this.closed = false; // React dev mode closes and restarts effects
    const pc = new RTCPeerConnection(LAN_ONLY);
    this.attach(pc, pc.createDataChannel("game"));
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    return { pc, packed: pack(pc.localDescription!.sdp) };
  }

  // Step 3: the guest's reply QR.
  async acceptReply(pc: RTCPeerConnection, packedAnswer: string) {
    const sdp = unpack(packedAnswer);
    if (!sdp.startsWith("v=")) throw new Error("That isn't a reply code from this game.");
    await pc.setRemoteDescription({ type: "answer", sdp });
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
        if (old && old.pc !== pc) old.pc.close(); // re-paired guest replaces their old link
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
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
  }
}

type GuestEvents = { message(m: HostMsg): void; status(s: GuestStatus): void };

export class GuestNet {
  private dc: RTCDataChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private closed = false;
  private token: string;
  private name: string;
  private on: GuestEvents;

  constructor(token: string, name: string, on: GuestEvents) {
    this.token = token;
    this.name = name;
    this.on = on;
  }

  // Step 2: answer the host's invite; returns the packed reply for the guest's QR.
  async answerInvite(packedOffer: string): Promise<string> {
    const sdp = unpack(packedOffer);
    if (!sdp.startsWith("v=")) throw new Error("bad invite");
    this.on.status("pairing");
    const pc = new RTCPeerConnection(LAN_ONLY);
    this.pc = pc;
    pc.ondatachannel = (e) => {
      const dc = e.channel;
      const ready = () => this.wire(dc);
      if (dc.readyState === "open") ready();
      else dc.addEventListener("open", ready, { once: true });
    };
    pc.addEventListener("iceconnectionstatechange", () => {
      if (pc.iceConnectionState === "failed" && !this.closed) this.on.status("failed");
    });
    await pc.setRemoteDescription({ type: "offer", sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    return pack(pc.localDescription!.sdp);
  }

  private wire(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onmessage = (e) => {
      try {
        this.on.message(JSON.parse(e.data));
      } catch {
        /* ignore junk */
      }
    };
    dc.onclose = () => {
      if (!this.closed) this.on.status("lost");
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
