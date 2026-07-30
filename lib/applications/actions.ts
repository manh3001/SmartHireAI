"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { applySchema } from "./schema";
import { APPLICATION_STATUSES, canWithdraw, type ApplicationStatus } from "./status";
import { runApply, type ApplyDeps } from "./apply";
import { runChangeStatus, type ChangeStatusDeps } from "./transition";
import { loadCvInput } from "@/lib/cv/load";
import { requestEvaluation } from "@/lib/ai/request-evaluation";
import { buildEvaluationPrompt } from "@/lib/ai/prompt";
import { createRateLimiter } from "@/lib/ai/rate-limit";

const previewLimiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function previewMatch(
  jobId: string,
  cvId: string,
): Promise<
  | { ok: true; evaluationId: string; score: number; summary: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới xem điểm phù hợp" };

  if (!previewLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: { id: true, rawText: true },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  try {
    const result = await requestEvaluation(
      buildEvaluationPrompt(cv, job.rawText),
    );
    const ev = await prisma.evaluation.create({
      data: {
        cvId,
        jobDescriptionId: job.id,
        userId,
        overallScore: result.overallScore,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        matchedKeywords: result.matchedKeywords,
        missingKeywords: result.missingKeywords,
        skillGaps: result.skillGaps,
        summary: result.summary,
        rawModelOutput: result,
      },
      select: { id: true },
    });
    return {
      ok: true,
      evaluationId: ev.id,
      score: result.overallScore,
      summary: result.summary,
    };
  } catch {
    return { ok: false, error: "AI đánh giá thất bại, vui lòng thử lại" };
  }
}

export async function submitApplication(input: {
  jobId: string;
  cvId: string;
  coverLetter: string;
  evaluationId: string | null;
}): Promise<
  { ok: true; applicationId: string } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được ứng tuyển" };

  const parsed = applySchema.safeParse({
    cvId: input.cvId,
    coverLetter: input.coverLetter,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const trustedEvaluationId = input.evaluationId
    ? (
        await prisma.evaluation.findFirst({
          where: {
            id: input.evaluationId,
            userId,
            cvId: input.cvId,
            jobDescriptionId: input.jobId,
          },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const deps: ApplyDeps = {
    findPublicJob: (jobId) =>
      prisma.jobDescription.findFirst({
        where: { id: jobId, isPublic: true },
        select: { id: true },
      }),
    findExistingApplication: (jobId, candidateId) =>
      prisma.application.findFirst({
        where: { jobId, candidateId },
        select: { id: true },
      }),
    findCandidateCv: (cvId, candidateId) => loadCvInput(cvId, candidateId),
    createApplication: async (data) => {
      const app = await prisma.application.create({
        data: {
          jobId: data.jobId,
          candidateId: data.candidateId,
          cvId: data.cvId,
          cvSnapshot: data.cvSnapshot,
          coverLetter: data.coverLetter,
          evaluationId: data.evaluationId,
          events: { create: { toStatus: "SUBMITTED" } },
        },
        select: { id: true },
      });
      return { id: app.id };
    },
  };

  const outcome = await runApply(
    {
      jobId: input.jobId,
      candidateId: userId,
      cvId: input.cvId,
      coverLetter: parsed.data.coverLetter,
      evaluationId: trustedEvaluationId,
    },
    deps,
  );

  if (outcome.ok) {
    revalidatePath("/applications");
    revalidatePath(`/jobs/${input.jobId}`);
  }
  return outcome;
}

export async function withdrawApplication(
  applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được rút đơn" };

  const app = await prisma.application.findFirst({
    where: { id: applicationId, candidateId: userId },
    select: { id: true, status: true },
  });
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };
  if (!canWithdraw(app.status))
    return { ok: false, error: "Không thể rút đơn ở trạng thái này" };

  await prisma.application.delete({ where: { id: app.id } });
  revalidatePath("/applications");
  return { ok: true };
}

export async function changeStatus(
  applicationId: string,
  toStatus: ApplicationStatus,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng mới đổi trạng thái" };

  if (!APPLICATION_STATUSES.includes(toStatus))
    return { ok: false, error: "Trạng thái không hợp lệ" };

  const deps: ChangeStatusDeps = {
    findApplicationForRecruiter: (appId, recruiterId) =>
      prisma.application.findFirst({
        where: { id: appId, job: { userId: recruiterId } },
        select: { id: true, status: true },
      }),
    applyStatusChange: async (data) => {
      await prisma.$transaction([
        prisma.application.update({
          where: { id: data.applicationId },
          data: { status: data.toStatus },
        }),
        prisma.applicationEvent.create({
          data: {
            applicationId: data.applicationId,
            fromStatus: data.fromStatus,
            toStatus: data.toStatus,
            note: data.note,
          },
        }),
      ]);
    },
  };

  const outcome = await runChangeStatus(
    { applicationId, recruiterId: userId, toStatus, note },
    deps,
  );
  if (outcome.ok) revalidatePath("/applications");
  return outcome;
}
