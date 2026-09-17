import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/register";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { assertSameOrigin } from "@/lib/security/origin";
import { createVerification } from "@/lib/auth/email-verification";
import { verifyEmailHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export async function POST(req: Request) {
  try {
    if (!assertSameOrigin(req)) {
      return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
    }
    const ip = getClientIp(req);
    if (!(await checkRateLimit("register", ip))) {
      return NextResponse.json(
        { error: "Bạn thao tác quá nhiều lần, vui lòng thử lại sau" },
        { status: 429 },
      );
    }

    const body = await req.json();
    const result = await registerUser(body, {
      findByEmail: (email) =>
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
      create: (data) =>
        prisma.user.create({ data, select: { id: true } }),
      hash: hashPassword,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Tạo token xác minh + gửi email (bỏ qua êm nếu chưa cấu hình email).
    try {
      const { raw } = await createVerification(result.userId, {
        createToken: (t) => prisma.authToken.create({ data: t }).then(() => undefined),
      });
      const link = `${process.env.APP_URL ?? ""}/verify-email?token=${raw}`;
      await sendEmail({
        to: body.email,
        subject: "Xác minh email của bạn",
        html: verifyEmailHtml(link),
      });
    } catch (e) {
      console.warn("[register] gửi email xác minh thất bại:", e);
    }
    await recordAudit(
      { action: AUDIT_ACTIONS.register, userId: result.userId, ip },
      {
        save: (en) =>
          prisma.auditLog
            .create({
              data: {
                action: en.action,
                userId: en.userId ?? undefined,
                targetId: en.targetId ?? undefined,
                ip: en.ip ?? undefined,
                metadata: en.metadata as import("@prisma/client").Prisma.InputJsonValue ?? undefined,
              },
            })
            .then(() => undefined),
      },
    );
    return NextResponse.json({ userId: result.userId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Có lỗi xảy ra, vui lòng thử lại" },
      { status: 500 },
    );
  }
}
