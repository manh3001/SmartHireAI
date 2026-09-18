"use server";

import { headers } from "next/headers";
import QRCode from "qrcode";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { resolveCredentials } from "@/lib/auth/credentials";
import { verifyPassword } from "@/lib/auth/password";
import { generateSecret, totpUri, verifyTotp } from "@/lib/auth/totp";
import { encryptSecret, safeDecryptSecret } from "@/lib/auth/totp-crypto";
import { generateBackupCodes, hashBackupCode } from "@/lib/auth/backup-codes";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { recordAudit, AUDIT_ACTIONS, type AuditEntry } from "@/lib/audit/log";

async function clientIp(): Promise<string> {
  return getClientIp(new Request("http://x", { headers: await headers() }));
}

const auditSave = {
  save: (en: AuditEntry) =>
    prisma.auditLog
      .create({
        data: {
          action: en.action,
          userId: en.userId ?? undefined,
          targetId: en.targetId ?? undefined,
          ip: en.ip ?? undefined,
          metadata: en.metadata != null ? (en.metadata as Prisma.InputJsonValue) : undefined,
        },
      })
      .then(() => undefined),
};

export async function verifyPasswordStep(
  email: string,
  password: string,
): Promise<"invalid" | "ok" | "needs2fa"> {
  const ip = await clientIp();
  if (!(await checkRateLimit("login", `${ip}:${email}`))) return "invalid";
  const authed = await resolveCredentials(email, password, {
    findByEmail: (e) =>
      prisma.user.findUnique({
        where: { email: e },
        select: { id: true, email: true, name: true, role: true, passwordHash: true },
      }),
    verify: verifyPassword,
  });
  if (!authed) return "invalid";
  const u = await prisma.user.findUnique({
    where: { id: authed.id },
    select: { totpEnabled: true },
  });
  return u?.totpEnabled ? "needs2fa" : "ok";
}

export async function beginTotpEnrollment(): Promise<
  { ok: true; qrDataUrl: string; secret: string } | { ok: false; error: string }
> {
  const session = await requireUser();
  const userId = session.user.id;
  if (!(await checkRateLimit("login", `2fa:${userId}`)))
    return { ok: false, error: "Bạn thử quá nhiều lần, hãy đợi rồi thử lại" };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, totpEnabled: true } });
  if (!user) return { ok: false, error: "Không tìm thấy tài khoản" };
  if (user.totpEnabled) return { ok: false, error: "2FA đã được bật" };

  const secret = generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptSecret(secret), totpEnabled: false },
  });
  const uri = totpUri({ secret, email: user.email, issuer: "SmartHire" });
  const qrDataUrl = await QRCode.toDataURL(uri);
  return { ok: true, qrDataUrl, secret };
}

export async function confirmTotpEnrollment(
  code: string,
): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const session = await requireUser();
  const userId = session.user.id;
  if (!(await checkRateLimit("login", `2fa:${userId}`)))
    return { ok: false, error: "Bạn thử quá nhiều lần, hãy đợi rồi thử lại" };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpEnabled: true } });
  if (!user?.totpSecret) return { ok: false, error: "Chưa bắt đầu thiết lập 2FA" };
  if (user.totpEnabled) return { ok: false, error: "2FA đã được bật" };
  const pendingSecret = safeDecryptSecret(user.totpSecret);
  if (!pendingSecret || !verifyTotp(pendingSecret, code)) return { ok: false, error: "Mã không đúng" };

  const { plain, hashes } = generateBackupCodes(10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
  ]);
  await recordAudit({ action: AUDIT_ACTIONS.twoFactorEnable, userId, ip: await clientIp() }, auditSave);
  return { ok: true, backupCodes: plain };
}

async function verifyUserCode(userId: string, secretEnc: string | null, code: string): Promise<boolean> {
  if (secretEnc) { const s = safeDecryptSecret(secretEnc); if (s && verifyTotp(s, code)) return true; }
  const r = await prisma.twoFactorBackupCode.updateMany({
    where: { userId, codeHash: hashBackupCode(code), usedAt: null },
    data: { usedAt: new Date() },
  });
  return r.count === 1;
}

export async function disableTwoFactor(code: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireUser();
  const userId = session.user.id;
  if (!(await checkRateLimit("login", `2fa:${userId}`)))
    return { ok: false, error: "Bạn thử quá nhiều lần, hãy đợi rồi thử lại" };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpEnabled: true } });
  if (!user?.totpEnabled) return { ok: false, error: "2FA chưa được bật" };
  if (!(await verifyUserCode(userId, user.totpSecret, code))) return { ok: false, error: "Mã không đúng" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
  ]);
  await recordAudit({ action: AUDIT_ACTIONS.twoFactorDisable, userId, ip: await clientIp() }, auditSave);
  return { ok: true };
}

export async function regenerateBackupCodes(
  code: string,
): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const session = await requireUser();
  const userId = session.user.id;
  if (!(await checkRateLimit("login", `2fa:${userId}`)))
    return { ok: false, error: "Bạn thử quá nhiều lần, hãy đợi rồi thử lại" };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpEnabled: true } });
  if (!user?.totpEnabled) return { ok: false, error: "2FA chưa được bật" };
  if (!(await verifyUserCode(userId, user.totpSecret, code))) return { ok: false, error: "Mã không đúng" };

  const { plain, hashes } = generateBackupCodes(10);
  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
  ]);
  await recordAudit(
    { action: AUDIT_ACTIONS.twoFactorRegenerateBackup, userId, ip: await clientIp() },
    auditSave,
  );
  return { ok: true, backupCodes: plain };
}
