// PartyKit room server: one room per 8-character code. It holds the game state, runs the rules,
// and sends every player only their own view. The first player to say hello with `create` becomes host.
import type * as Party from "partykit/server";
import { newGame, reduce as reduceImposter, viewFor, type Action as IAction, type GameState } from "../lib/game.ts";
import { newMafia, reduceMafia, viewMafia, type MAction, type MState } from "../lib/mafia.ts";

type Game = "imposter" | "mafia";
type Hello = { type: "hello"; token: string; name: string; create?: Game };
type ClientMsg = Hello | { type: "action"; action: IAction | MAction };
type ConnState = { token: string };

const GUEST_IMPOSTER = new Set(["revealed", "vote", "guess"]);
const GUEST_MAFIA = new Set(["revealed", "night", "vote"]);

export default class Room implements Party.Server {
  game: Game | null = null;
  host: string | null = null;
  imposter: GameState | null = null;
  mafia: MState | null = null;

  constructor(readonly room: Party.Room) {}

  onMessage(raw: string | ArrayBuffer | ArrayBufferView, conn: Party.Connection<ConnState>) {
    if (typeof raw !== "string" || raw.length > 20_000) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "hello") return this.hello(msg, conn);
    const token = conn.state?.token;
    if (msg.type !== "action" || !token || !msg.action || typeof msg.action !== "object") return;
    const a = msg.action as { type: string; id?: string; voter?: string };
    const isHost = token === this.host;
    const allowed = this.game === "imposter" ? GUEST_IMPOSTER : GUEST_MAFIA;
    // Guests may only act for themselves; joins/connection changes come from the server only.
    if (a.type === "join" || a.type === "connected") return;
    if (!isHost && !(allowed.has(a.type) && (a.id ?? a.voter) === token)) return;
    this.apply(msg.action);
  }

  hello(msg: Hello, conn: Party.Connection<ConnState>) {
    if (typeof msg.token !== "string" || typeof msg.name !== "string") return;
    const token = msg.token.slice(0, 40);
    if (!this.game) {
      if (msg.create !== "imposter" && msg.create !== "mafia") return conn.send(JSON.stringify({ type: "missing" }));
      this.game = msg.create;
      this.host = token;
      if (this.game === "imposter") this.imposter = newGame();
      else this.mafia = newMafia();
    } else if (msg.create && token !== this.host && !this.hasPlayer(token)) {
      return conn.send(JSON.stringify({ type: "taken" })); // code collision with someone else's room
    }
    conn.setState({ token });
    this.apply({ type: "join", id: token, name: msg.name });
  }

  onClose(conn: Party.Connection<ConnState>) {
    const token = conn.state?.token;
    if (!token) return;
    for (const c of this.room.getConnections<ConnState>()) if (c !== conn && c.state?.token === token) return; // another tab still open
    this.apply({ type: "connected", id: token, connected: false });
  }

  hasPlayer(token: string) {
    return !!(this.imposter?.players.some((p) => p.id === token) || this.mafia?.players.some((p) => p.id === token));
  }

  apply(action: IAction | MAction) {
    if (this.imposter) this.imposter = reduceImposter(this.imposter, action as IAction);
    if (this.mafia) this.mafia = reduceMafia(this.mafia, action as MAction);
    this.broadcast();
  }

  broadcast() {
    for (const c of this.room.getConnections<ConnState>()) {
      const token = c.state?.token;
      if (!token) continue;
      const body = this.imposter ? viewFor(this.imposter, token) : { state: viewMafia(this.mafia!, token), secret: null };
      c.send(JSON.stringify({ type: "state", game: this.game, host: this.host, ...body }));
    }
  }
}

Room satisfies Party.Worker;
