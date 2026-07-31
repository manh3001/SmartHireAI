"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { messageSchema } from "./schema";
import { isThreadParticipant } from "./access";

export async function sendMessage(
  applicationId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true, job: { select: { userId: true } } },
  });
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  if (!isThreadParticipant(userId, { candidateId: app.candidateId, recruiterId: app.job.userId }))
    return { ok: false, error: "Bạn không có quyền nhắn tin trong đơn này" };

  const parsed = messageSchema.safeParse({ body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.message.create({
    data: { applicationId, senderId: userId, body: parsed.data.body },
  });

  revalidatePath(`/messages/${applicationId}`);
  return { ok: true };
}
