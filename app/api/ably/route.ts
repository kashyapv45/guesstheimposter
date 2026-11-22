// Issues Ably passes for online rooms. Needs ABLY_API_KEY (server-only env var).
//   GET ?t=<secret>&code=new   -> { code }   the host's room code, derived from the host's secret
//   GET ?t=<secret>&code=<CODE> -> Ably TokenRequest, locked to this room:
//       host  (code matches its secret): read the room inbox, write to every player's private channel
//       guest: write to the room inbox, read only its own private channel
// Player ids are a keyed hash of the secret, so ids shown to others can't be used to read someone's channel.
import { createHttpClient } from "@ably/pubsub-server";
import { createHmac } from "node:crypto";
import { ALPHABET, isValidCode } from "@/lib/roomCode";

const KEY = process.env.ABLY_API_KEY;
const SECRET = /^[a-z0-9]{8,40}$/;
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const mac = (label: string, t: string) => createHmac("sha256", KEY!).update(`${label}:${t}`).digest();

const playerId = (t: string) => mac("pid", t).toString("hex").slice(0, 16);
const codeFor = (t: string) => Array.from(mac("code", t).subarray(0, 8), (b) => ALPHABET[b % ALPHABET.length]).join("");

export async function GET(req: Request) {
  if (!KEY) return fail("nosetup", 503);
  const q = new URL(req.url).searchParams;
  const t = q.get("t") ?? "";
  const code = q.get("code") ?? "";
  if (!SECRET.test(t)) return fail("bad secret");
  if (code === "new") return Response.json({ code: codeFor(t) });
  if (!isValidCode(code)) return fail("bad code");

  const pid = playerId(t);
  const room = `room:${code}`;
  const capability =
    codeFor(t) === code
      ? { [`${room}:host`]: ["subscribe", "presence"], [`${room}:p:*`]: ["publish"] }
      : { [`${room}:host`]: ["publish", "presence", "presence-subscribe"], [`${room}:p:${pid}`]: ["subscribe"] };
  const tokenRequest = await createHttpClient({ key: KEY }).auth.createTokenRequest({
    clientId: pid,
    capability: JSON.stringify(capability),
    ttl: 4 * 60 * 60 * 1000,
  });
  return Response.json(tokenRequest);
}
