import { randomBytes, createHash } from "node:crypto";

const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // bỏ ký tự dễ nhầm (0/O/1/I)

export function hashBackupCode(plain: string): string {
  const norm = plain.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  return createHash("sha256").update(norm).digest("hex");
}

function oneCode(): string {
  const bytes = randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i++) s += ALPHA[bytes[i] % ALPHA.length];
  return s.slice(0, 5) + "-" + s.slice(5);
}

export function generateBackupCodes(n = 10): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: n }, oneCode);
  return { plain, hashes: plain.map(hashBackupCode) };
}
