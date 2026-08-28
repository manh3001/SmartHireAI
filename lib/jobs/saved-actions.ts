"use server";

import { revalidateTag } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { CACHE_TAGS } from "@/lib/cache/tags";

export async function toggleSaveJob(
  jobId: string,
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới lưu tin" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: { id: true },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true },
  });

  let saved: boolean;
  if (existing) {
    await prisma.savedJob.delete({ where: { id: existing.id } });
    saved = false;
  } else {
    await prisma.savedJob.create({ data: { userId, jobId } });
    saved = true;
  }

  revalidateTag(CACHE_TAGS.jobs, "max");
  return { ok: true, saved };
}
