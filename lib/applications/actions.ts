"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { applySchema } from "./schema";
import { APPLICATION_STATUSES, canWithdraw, STATUS_LABELS, type ApplicationStatus } from "./status";
import { createNotification } from "@/lib/notifications/create";
import { statusChangeNotification, newApplicationNotification } from "@/lib/notifications/messages";
import { runApply, type ApplyDeps } from "./apply";
import { runChangeStatus, type ChangeStatusDeps } from "./transition";
import { loadCvInput } from "@/lib/cv/load";
import { requestEvaluation } from "@/lib/ai/request-evaluation";
import { buildEvaluationPrompt } from "@/lib/ai/prompt";
import { composeJdText } from "@/lib/jobs/job-fields";
import { checkRateLimit } from "@/lib/security/ratelimit";
import type { EvaluationResult } from "@/lib/ai/schema";

export async function previewMatch(
  jobId: string,
  cvId: string,
): Promise<
  { ok: true; score: number; summary: string } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới xem điểm phù hợp" };

  if (!(await checkRateLimit("ai", userId)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: {
      id: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  try {
    const result = await requestEvaluation(buildEvaluationPrompt(cv, composeJdText(job)));
    return { ok: true, score: result.overallScore, summary: result.summary };
  } catch {
    return { ok: false, error: "AI đánh giá thất bại, vui lòng thử lại" };
  }
}

export async function submitApplication(input: {
  jobId: string;
  cvId: string;
  coverLetter: string;
}): Promise<
  { ok: true; applicationId: string } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được ứng tuyển" };

  if (!(await checkRateLimit("mutation", userId)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const parsed = applySchema.safeParse({
    cvId: input.cvId,
    coverLetter: input.coverLetter,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  // Nạp job (kèm rawText để tính điểm chính thức lúc nộp). runApply dùng lại
  // đúng object này qua findPublicJob nên không truy vấn job hai lần.
  const job = await prisma.jobDescription.findFirst({
    where: { id: input.jobId, isPublic: true },
    select: {
      id: true, rawText: true, userId: true, title: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });

  const deps: ApplyDeps = {
    findPublicJob: async () => job,
    // Khớp mọi đơn theo (jobId, candidateId) bất kể trạng thái: rút đơn là
    // quyết định cuối cho job đó — ứng viên đã rút KHÔNG nộp lại được (cũng
    // trùng ràng buộc @@unique([jobId, candidateId]) ở schema). Đây là hành vi
    // chủ đích, không phải thiếu sót.
    findExistingApplication: (jobId, candidateId) =>
      prisma.application.findFirst({
        where: { jobId, candidateId },
        select: { id: true },
      }),
    findCandidateCv: (cvId, candidateId) => loadCvInput(cvId, candidateId),
    createApplication: async (data) => {
      // job chắc chắn non-null ở đây (runApply chỉ gọi createApplication sau
      // khi findPublicJob trả về truthy).

      // Tính điểm CHÍNH THỨC ở server (không tin điểm client). AI gọi NGOÀI
      // transaction; lỗi AI -> đơn vẫn nộp, evaluationId = null.
      let evalData: (EvaluationResult & { rawModelOutput: EvaluationResult }) | null = null;
      try {
        const result = await requestEvaluation(
          buildEvaluationPrompt(data.cvSnapshot, composeJdText(job!)),
        );
        evalData = { ...result, rawModelOutput: result };
      } catch {
        evalData = null;
      }

      const appId = await prisma.$transaction(async (tx) => {
        let evaluationId: string | null = null;
        if (evalData) {
          const ev = await tx.evaluation.create({
            data: {
              cvId: data.cvId,
              jobDescriptionId: data.jobId,
              userId: data.candidateId,
              overallScore: evalData.overallScore,
              strengths: evalData.strengths,
              weaknesses: evalData.weaknesses,
              matchedKeywords: evalData.matchedKeywords,
              missingKeywords: evalData.missingKeywords,
              skillGaps: evalData.skillGaps,
              summary: evalData.summary,
              rawModelOutput: evalData.rawModelOutput,
            },
            select: { id: true },
          });
          evaluationId = ev.id;
        }
        const app = await tx.application.create({
          data: {
            jobId: data.jobId,
            candidateId: data.candidateId,
            cvId: data.cvId,
            cvSnapshot: data.cvSnapshot,
            coverLetter: data.coverLetter,
            evaluationId,
            events: { create: { toStatus: "SUBMITTED" } },
          },
          select: { id: true },
        });
        return app.id;
      });

      return { id: appId };
    },
  };

  const outcome = await runApply(
    {
      jobId: input.jobId,
      candidateId: userId,
      cvId: input.cvId,
      coverLetter: parsed.data.coverLetter,
    },
    deps,
  );

  if (outcome.ok) {
    revalidatePath("/applications");
    revalidatePath(`/jobs/${input.jobId}`);
  }
  if (outcome.ok && job) {
    try {
      await createNotification(
        job.userId,
        newApplicationNotification(
          session.user.name ?? "Ứng viên",
          job.title || "(chưa có tiêu đề)",
          input.jobId,
        ),
      );
    } catch {
      // thông báo lỗi không làm hỏng việc nộp đơn
    }
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

  await prisma.$transaction([
    prisma.application.update({
      where: { id: app.id },
      data: { status: "WITHDRAWN" },
    }),
    prisma.applicationEvent.create({
      data: {
        applicationId: app.id,
        fromStatus: app.status,
        toStatus: "WITHDRAWN",
      },
    }),
  ]);
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
  if (outcome.ok) {
    try {
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { candidateId: true, job: { select: { title: true } } },
      });
      if (app) {
        await createNotification(
          app.candidateId,
          statusChangeNotification(app.job.title || "(chưa có tiêu đề)", STATUS_LABELS[toStatus]),
        );
      }
    } catch {
      // thông báo lỗi không làm hỏng việc đổi trạng thái
    }
  }
  return outcome;
}
