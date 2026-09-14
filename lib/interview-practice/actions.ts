"use server";

import prisma from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { buildQuestionsPrompt, buildScoringPrompt } from "@/lib/ai/mock-interview-prompt";
import { requestMockQuestions, requestMockScoring } from "@/lib/ai/request-mock-interview";
import type { MockScoring } from "@/lib/ai/mock-interview-schema";

async function loadJd(jobId: string) {
  return prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: { title: true, company: true, rawText: true },
  });
}

export async function startMockInterview(
  jobId: string,
): Promise<{ ok: true; questions: string[] } | { ok: false; error: string }> {
  const session = await requireRole("CANDIDATE");
  if (!(await checkRateLimit("ai", session.user.id)))
    return { ok: false, error: "Bạn thao tác quá nhanh, vui lòng thử lại sau." };
  const jd = await loadJd(jobId);
  if (!jd) return { ok: false, error: "Không tìm thấy tin tuyển dụng." };
  try {
    const questions = await requestMockQuestions(buildQuestionsPrompt(jd));
    return { ok: true, questions };
  } catch {
    return { ok: false, error: "Không tạo được câu hỏi, vui lòng thử lại." };
  }
}

export async function scoreMockInterview(
  jobId: string,
  qa: { question: string; answer: string }[],
): Promise<{ ok: true; result: MockScoring } | { ok: false; error: string }> {
  const session = await requireRole("CANDIDATE");
  if (!(await checkRateLimit("ai", session.user.id)))
    return { ok: false, error: "Bạn thao tác quá nhanh, vui lòng thử lại sau." };
  if (!Array.isArray(qa) || qa.length === 0 || qa.every((x) => !x.answer.trim()))
    return { ok: false, error: "Hãy trả lời ít nhất một câu hỏi." };
  const jd = await loadJd(jobId);
  if (!jd) return { ok: false, error: "Không tìm thấy tin tuyển dụng." };
  try {
    const result = await requestMockScoring(buildScoringPrompt(jd, qa));
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Không chấm được, vui lòng thử lại." };
  }
}
