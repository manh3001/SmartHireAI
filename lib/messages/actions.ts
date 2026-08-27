"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { messageSchema } from "./schema";
import { isThreadParticipant } from "./access";
import { createNotification } from "@/lib/notifications/create";
import { newMessageNotification } from "@/lib/notifications/messages";
import { checkRateLimit } from "@/lib/security/ratelimit";

export async function sendMessage(
  applicationId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };

  if (!(await checkRateLimit("mutation", userId)))
    return { ok: false, error: "Bạn gửi quá nhanh, vui lòng chờ một chút" };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true, job: { select: { userId: true, title: true } } },
  });
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  if (!isThreadParticipant(userId, { candidateId: app.candidateId, recruiterId: app.job.userId }))
    return { ok: false, error: "Bạn không có quyền nhắn tin trong đơn này" };

  const parsed = messageSchema.safeParse({ body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.message.create({
    data: { applicationId, senderId: userId, body: parsed.data.body },
  });

  const recipientId = userId === app.candidateId ? app.job.userId : app.candidateId;
  try {
    await createNotification(
      recipientId,
      newMessageNotification(
        session.user.name ?? "Người dùng",
        app.job.title || "(chưa có tiêu đề)",
        applicationId,
      ),
    );
  } catch {
    // thông báo lỗi không làm hỏng việc gửi tin
  }

  revalidatePath(`/messages/${applicationId}`);
  return { ok: true };
}
