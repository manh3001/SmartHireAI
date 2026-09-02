"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { reviewSchema, canReview } from "./reviews";

export async function submitReview(
  companyId: string,
  raw: { rating: number | string; comment: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên được đánh giá" };

  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ" };

  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { userId: true },
  });
  if (!company) return { ok: false, error: "Không tìm thấy công ty" };

  const isOwner = company.userId === userId;
  const appliedCount = await prisma.application.count({
    where: { candidateId: userId, job: { userId: company.userId } },
  });
  if (!canReview({ hasApplied: appliedCount > 0, isOwner }))
    return { ok: false, error: "Bạn cần ứng tuyển công ty này trước khi đánh giá" };

  await prisma.companyReview.upsert({
    where: { userId_companyId: { userId, companyId } },
    create: { userId, companyId, rating: parsed.data.rating, comment: parsed.data.comment },
    update: { rating: parsed.data.rating, comment: parsed.data.comment },
  });

  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}

export async function deleteReview(
  companyId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };

  // deleteMany để không throw P2025 khi review đã bị xoá (race).
  await prisma.companyReview.deleteMany({ where: { userId, companyId } });

  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}
