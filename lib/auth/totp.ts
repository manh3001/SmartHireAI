import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpUri(input: { secret: string; email: string; issuer?: string }): string {
  const issuer = input.issuer ?? "SmartHire";
  const label = encodeURIComponent(`${issuer}:${input.email}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secretBuf: Buffer, counter: number, digits: number = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = Math.pow(10, digits);
  return (bin % mod).toString().padStart(digits, "0");
}

export function generateTotp(secret: string, forTime: number = Date.now()): string {
  const counter = Math.floor(forTime / 1000 / 30);
  return hotp(base32Decode(secret), counter, 8);
}

export function verifyTotp(
  secret: string,
  code: string,
  opts: { now?: number; window?: number } = {},
): boolean {
  const clean = (code || "").trim();
  if (!/^\d{8}$/.test(clean)) return false;
  const now = opts.now ?? Date.now();
  const window = opts.window ?? 1;
  const counter = Math.floor(now / 1000 / 30);
  const buf = base32Decode(secret);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(buf, counter + i, 8);
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(clean))) return true;
  }
  return false;
}
