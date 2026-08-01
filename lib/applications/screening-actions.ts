"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { requestScreening } from "@/lib/ai/request-screening";
import { composeJdText } from "@/lib/jobs/job-fields";
import {
  runScreening,
  MAX_SCREENING_APPLICANTS,
  type RunScreeningDeps,
  type ScreeningApplicantInput,
} from "./screening";
import type { CvInput } from "@/lib/cv/types";

const screeningLimiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function screenApplicants(
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng mới sàng lọc" };

  if (!screeningLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const rows = await prisma.application.findMany({
    where: { jobId, status: { not: "WITHDRAWN" } },
    select: {
      id: true,
      cvSnapshot: true,
      candidate: { select: { name: true } },
      evaluation: { select: { overallScore: true } },
    },
  });

  // Sắp theo điểm giảm dần (đơn chưa có điểm xếp sau), cắt còn tối đa 20.
  rows.sort(
    (a, b) => (b.evaluation?.overallScore ?? -1) - (a.evaluation?.overallScore ?? -1),
  );
  const applicants: ScreeningApplicantInput[] = rows
    .slice(0, MAX_SCREENING_APPLICANTS)
    .map((r) => ({
      applicationId: r.id,
      candidateName: r.candidate.name,
      cv: r.cvSnapshot as unknown as CvInput,
      score: r.evaluation?.overallScore ?? null,
    }));

  const deps: RunScreeningDeps = {
    requestScreening,
    saveScreening: async (data) => {
      await prisma.screening.upsert({
        where: { jobId: data.jobId },
        create: {
          jobId: data.jobId,
          summary: data.summary,
          result: data.result,
          rawModelOutput: data.rawModelOutput,
        },
        update: {
          summary: data.summary,
          result: data.result,
          rawModelOutput: data.rawModelOutput,
        },
      });
    },
  };

  const outcome = await runScreening(
    { jobId: job.id, jdText: composeJdText(job), applicants },
    deps,
  );

  if (outcome.ok) revalidatePath(`/jobs/${jobId}/screening`);
  return outcome;
}
