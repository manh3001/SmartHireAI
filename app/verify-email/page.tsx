import Link from "next/link";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { confirmVerification } from "@/lib/auth/email-verification";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { buttonVariants } from "@/components/ui/button";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let state: "ok" | "invalid" | "expired" | "used" | "missing" = "missing";

  if (token) {
    const result = await confirmVerification(token, {
      findToken: (tokenHash) =>
        prisma.authToken.findUnique({
          where: { tokenHash },
          select: { userId: true, purpose: true, expiresAt: true, usedAt: true },
        }),
      markVerified: async (tokenHash, userId, at) => {
        await prisma.$transaction(async (tx) => {
          const consumed = await tx.authToken.updateMany({
            where: { tokenHash, usedAt: null },
            data: { usedAt: at },
          });
          if (consumed.count === 0) return; // đã bị dùng bởi request khác
          await tx.user.update({ where: { id: userId }, data: { emailVerified: at } });
        });
      },
    });
    state = result.ok ? "ok" : result.reason;
    if (result.ok) {
      await recordAudit(
        { action: AUDIT_ACTIONS.emailVerify, userId: result.userId },
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
  }

  const MESSAGES: Record<typeof state, string> = {
    ok: "Email của bạn đã được xác minh. Cảm ơn bạn!",
    invalid: "Liên kết không hợp lệ.",
    expired: "Liên kết đã hết hạn. Hãy yêu cầu gửi lại email xác minh.",
    used: "Liên kết đã được sử dụng.",
    missing: "Thiếu mã xác minh.",
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-3 text-xl font-bold text-foreground">Xác minh email</h1>
        <p className="mb-6 text-sm text-muted-foreground">{MESSAGES[state]}</p>
        <Link className={buttonVariants()} href="/dashboard">
          Về trang tổng quan
        </Link>
      </div>
    </div>
  );
}
