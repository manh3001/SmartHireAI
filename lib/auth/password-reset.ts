import { generateToken, hashToken, tokenExpiry } from "./tokens";
import { passwordStrength } from "./password-strength";

type StoredToken = {
  userId: string;
  purpose: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type RequestResetDeps = {
  findUser: (email: string) => Promise<{ id: string; hasPassword: boolean } | null>;
  createToken: (t: {
    userId: string;
    purpose: "PASSWORD_RESET";
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  now?: () => Date;
};

export async function requestReset(
  email: string,
  deps: RequestResetDeps,
): Promise<{ raw: string; userId: string } | null> {
  const user = await deps.findUser(email);
  if (!user || !user.hasPassword) return null;
  const now = deps.now?.() ?? new Date();
  const { raw, hash } = generateToken();
  await deps.createToken({
    userId: user.id,
    purpose: "PASSWORD_RESET",
    tokenHash: hash,
    expiresAt: tokenExpiry("PASSWORD_RESET", now),
  });
  return { raw, userId: user.id };
}

export type ConfirmResetResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "weak"; message?: string };

export type ConfirmResetDeps = {
  findToken: (tokenHash: string) => Promise<StoredToken | null>;
  hash: (pw: string) => Promise<string>;
  applyReset: (userId: string, passwordHash: string, tokenHash: string, at: Date) => Promise<void>;
  now?: () => Date;
};

export async function confirmReset(
  rawToken: string,
  newPassword: string,
  deps: ConfirmResetDeps,
): Promise<ConfirmResetResult> {
  const now = deps.now?.() ?? new Date();
  const hash = hashToken(rawToken);
  const token = await deps.findToken(hash);
  if (!token || token.purpose !== "PASSWORD_RESET") return { ok: false, reason: "invalid" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (token.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  const strength = passwordStrength(newPassword);
  if (!strength.ok) return { ok: false, reason: "weak", message: strength.error };

  const passwordHash = await deps.hash(newPassword);
  await deps.applyReset(token.userId, passwordHash, hash, now);
  return { ok: true, userId: token.userId };
}
