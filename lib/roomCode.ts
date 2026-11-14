// 8-char codes from an alphabet without 0, O, 1, I, L so they read aloud cleanly.
export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const VALID = new RegExp(`^[${ALPHABET}]{8}$`);

export function newRoomCode(): string {
  let out = "";
  const buf = new Uint8Array(1);
  const limit = 256 - (256 % ALPHABET.length); // reject the tail so every char is equally likely
  while (out.length < 8) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) out += ALPHABET[buf[0] % ALPHABET.length];
  }
  return out;
}

export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
export const isValidCode = (s: string) => VALID.test(s);
export const formatCode = (c: string) => (c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

export function randomId(len = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}
