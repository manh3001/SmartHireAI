import { randomBytes, createHash } from "node:crypto";

export type AuthTokenPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET";

const TTL_MS: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFY: 24 * 60 * 60_000,
  PASSWORD_RESET: 60 * 60_000,
};

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function tokenExpiry(purpose: AuthTokenPurpose, now: Date = new Date()): Date {
  return new Date(now.getTime() + TTL_MS[purpose]);
}
