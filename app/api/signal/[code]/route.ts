// WebRTC handshake mailbox. Only SDP text passes through here; gameplay goes phone-to-phone over the local Wi-Fi.
//   POST {kind:"create", secret}            host claims (or keeps alive) the room: 1h TTL, refreshed while playing
//   POST {kind:"close", secret}             host ends the room
//   POST {kind:"offer", peer, sdp}          guest leaves an offer
//   GET  ?secret=...                        host collects pending offers
//   POST {kind:"answer", secret, peer, sdp} host replies
//   GET  ?peer=...                          guest collects its answer
//   GET                                     { exists }
import { kv, kvKind } from "@/lib/kv";
import { isValidCode } from "@/lib/roomCode";

const ROOM_TTL = 60 * 60; // 1 hour without activity
const ID = /^[a-z0-9]{8,40}$/;
const MAX_SDP = 20_000;
const MAX_PENDING = 32;

type Ctx = { params: Promise<{ code: string }> };
const fail = (error: string, status = 400) => Response.json({ error }, { status });
// On Vercel each request may hit a different instance, so memory can't hold rooms: say so instead of "room not found".
const noSharedStore = () => kvKind === "memory" && !!process.env.VERCEL && fail("no-store", 503);

export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const off = noSharedStore();
  if (off) return off;
  if (!isValidCode(code)) return fail("bad code");
  const q = new URL(req.url).searchParams;
  const peer = q.get("peer");
  const secret = q.get("secret");

  if (peer) {
    if (!ID.test(peer)) return fail("bad peer");
    const key = `answer:${code}:${peer}`;
    const sdp = await kv.get(key);
    if (sdp) await kv.del(key);
    return Response.json({ sdp });
  }

  const roomSecret = await kv.get(`room:${code}`);
  if (secret) {
    if (!roomSecret || secret !== roomSecret) return fail("forbidden", 403);
    const offers = await kv.hgetall(`offers:${code}`);
    await kv.hdel(`offers:${code}`, Object.keys(offers));
    return Response.json({ offers });
  }
  return Response.json({ exists: !!roomSecret });
}

export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const off = noSharedStore();
  if (off) return off;
  if (!isValidCode(code)) return fail("bad code");
  let body: { kind?: unknown; secret?: unknown; peer?: unknown; sdp?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("bad json");
  }
  const { kind, secret, peer, sdp } = body;
  const roomKey = `room:${code}`;

  if (kind === "create") {
    if (typeof secret !== "string" || !ID.test(secret)) return fail("bad secret");
    const existing = await kv.get(roomKey);
    if (existing && existing !== secret) return fail("code taken", 409);
    await kv.set(roomKey, secret, ROOM_TTL);
    return Response.json({ ok: true });
  }

  if (kind === "close") {
    if (typeof secret === "string" && (await kv.get(roomKey)) === secret) {
      await kv.del(roomKey);
      await kv.del(`offers:${code}`);
    }
    return Response.json({ ok: true });
  }

  if (typeof peer !== "string" || !ID.test(peer) || typeof sdp !== "string" || !sdp || sdp.length > MAX_SDP) return fail("bad request");
  const roomSecret = await kv.get(roomKey);
  if (!roomSecret) return fail("no such room", 404);

  if (kind === "offer") {
    if (Object.keys(await kv.hgetall(`offers:${code}`)).length >= MAX_PENDING) return fail("busy", 429);
    await kv.hset(`offers:${code}`, peer, sdp, ROOM_TTL);
    return Response.json({ ok: true });
  }
  if (kind === "answer") {
    if (secret !== roomSecret) return fail("forbidden", 403);
    await kv.set(`answer:${code}:${peer}`, sdp, 120);
    return Response.json({ ok: true });
  }
  return fail("unknown kind");
}
