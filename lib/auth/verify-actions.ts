"use server";

import prisma from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createVerification } from "@/lib/auth/email-verification";
import { verifyEmailHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/ratelimit";

export async function resendVerification(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user?.id) return { ok: false, error: "Chưa đăng nhập" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerified: true },
  });
  if (!dbUser) return { ok: false, error: "Không tìm thấy tài khoản" };
  if (dbUser.emailVerified) return { ok: true }; // đã xác minh, không gửi lại

  if (!(await checkRateLimit("register", user.id)))
    return { ok: false, error: "Bạn thao tác quá nhiều lần, thử lại sau" };

  const { raw } = await createVerification(user.id, {
    createToken: (t) => prisma.authToken.create({ data: t }).then(() => undefined),
  });
  const link = `${process.env.APP_URL ?? ""}/verify-email?token=${raw}`;
  await sendEmail({ to: dbUser.email, subject: "Xác minh email của bạn", html: verifyEmailHtml(link) });
  return { ok: true };
}
