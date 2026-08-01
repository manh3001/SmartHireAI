"use server";

import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { loadCvInput } from "@/lib/cv/load";
import { requestRecommendations } from "@/lib/ai/request-recommendations";
import { composeJdText } from "@/lib/jobs/job-fields";
import {
  runRecommendations,
  MAX_RECOMMEND_JOBS,
  type RecommendationJobInput,
  type RunRecommendationsOutcome,
} from "./recommendations";

const recommendLimiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function recommendJobs(
  cvId: string,
): Promise<RunRecommendationsOutcome> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được gợi ý việc" };

  if (!recommendLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  const applied = await prisma.application.findMany({
    where: { candidateId: userId },
    select: { jobId: true },
  });
  const appliedJobIds = applied.map((a) => a.jobId);

  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true, id: { notIn: appliedJobIds } },
    orderBy: { createdAt: "desc" },
    take: MAX_RECOMMEND_JOBS,
    select: {
      id: true, title: true, company: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });

  const jobs: RecommendationJobInput[] = rows.map((r) => ({
    jobId: r.id,
    title: r.title,
    company: r.company,
    rawText: composeJdText(r),
  }));

  return runRecommendations({ cv, jobs }, { requestRecommendations });
}
