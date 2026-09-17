"use server";

import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { requestReset, confirmReset } from "@/lib/auth/password-reset";
import { resetPasswordHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const GENERIC = "Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.";

export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<{ message: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = getClientIp(new Request("http://x", { headers: await headers() }));

  if (!email || !(await checkRateLimit("passwordReset", ip))) return { message: GENERIC };

  const res = await requestReset(email, {
    findUser: async (e) => {
      const u = await prisma.user.findUnique({
        where: { email: e },
        select: { id: true, passwordHash: true },
      });
      return u ? { id: u.id, hasPassword: !!u.passwordHash } : null;
    },
    createToken: (t) => prisma.authToken.create({ data: t }).then(() => undefined),
  });

  if (res) {
    const link = `${process.env.APP_URL ?? ""}/reset-password?token=${res.raw}`;
    await sendEmail({ to: email, subject: "Đặt lại mật khẩu", html: resetPasswordHtml(link) });
    await recordAudit(
      { action: AUDIT_ACTIONS.passwordResetRequest, userId: res.userId, ip },
      {
        save: (en) =>
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
      },
    );
  }
  return { message: GENERIC };
}

export async function confirmPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  const res = await confirmReset(token, password, {
    findToken: (tokenHash) =>
      prisma.authToken.findUnique({
        where: { tokenHash },
        select: { userId: true, purpose: true, expiresAt: true, usedAt: true },
      }),
    hash: hashPassword,
    applyReset: async (userId, passwordHash, tokenHash, at) => {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
        prisma.authToken.update({ where: { tokenHash }, data: { usedAt: at } }),
        // Vô hiệu mọi token reset khác còn hiệu lực của user.
        prisma.authToken.updateMany({
          where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
          data: { usedAt: at },
        }),
      ]);
    },
  });

  if (res.ok) {
    await recordAudit(
      { action: AUDIT_ACTIONS.passwordReset, userId: res.userId },
      {
        save: (en) =>
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
      },
    );
    return { ok: true, message: "Đặt lại mật khẩu thành công. Hãy đăng nhập lại." };
  }
  const MSG: Record<string, string> = {
    invalid: "Liên kết không hợp lệ.",
    expired: "Liên kết đã hết hạn.",
    used: "Liên kết đã được sử dụng.",
    weak: res.message ?? "Mật khẩu chưa đủ mạnh.",
  };
  return { ok: false, message: MSG[res.reason] };
}
