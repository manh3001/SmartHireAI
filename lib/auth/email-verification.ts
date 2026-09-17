import { generateToken, hashToken, tokenExpiry } from "./tokens";

export type CreateVerificationDeps = {
  createToken: (t: {
    userId: string;
    purpose: "EMAIL_VERIFY";
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  now?: () => Date;
};

export async function createVerification(
  userId: string,
  deps: CreateVerificationDeps,
): Promise<{ raw: string }> {
  const now = deps.now?.() ?? new Date();
  const { raw, hash } = generateToken();
  await deps.createToken({
    userId,
    purpose: "EMAIL_VERIFY",
    tokenHash: hash,
    expiresAt: tokenExpiry("EMAIL_VERIFY", now),
  });
  return { raw };
}

export type StoredToken = {
  userId: string;
  purpose: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type ConfirmVerificationResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export type ConfirmVerificationDeps = {
  findToken: (tokenHash: string) => Promise<StoredToken | null>;
  markVerified: (tokenHash: string, userId: string, at: Date) => Promise<void>;
  now?: () => Date;
};

export async function confirmVerification(
  rawToken: string,
  deps: ConfirmVerificationDeps,
): Promise<ConfirmVerificationResult> {
  const now = deps.now?.() ?? new Date();
  const hash = hashToken(rawToken);
  const token = await deps.findToken(hash);
  if (!token || token.purpose !== "EMAIL_VERIFY") return { ok: false, reason: "invalid" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (token.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  await deps.markVerified(hash, token.userId, now);
  return { ok: true, userId: token.userId };
}
