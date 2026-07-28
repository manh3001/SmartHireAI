import { buildEvaluationPrompt } from "./prompt";
import type { EvaluationResult } from "./schema";
import type { CvInput } from "@/lib/cv/types";

export type SaveEvaluationInput = {
  cvId: string;
  userId: string;
  jdText: string;
  jdTitle: string;
  jdCompany: string;
  result: EvaluationResult;
};

export type CvEvaluationDeps = {
  findCv: (cvId: string, userId: string) => Promise<CvInput | null>;
  requestEvaluation: (prompt: string) => Promise<EvaluationResult>;
  saveEvaluation: (data: SaveEvaluationInput) => Promise<{ id: string }>;
};

export type CvEvaluationParams = {
  cvId: string;
  userId: string;
  jdText: string;
  jdTitle: string;
  jdCompany: string;
};

export type CvEvaluationOutcome =
  | { ok: true; evaluationId: string; result: EvaluationResult }
  | { ok: false; error: string };

export async function runCvEvaluation(
  params: CvEvaluationParams,
  deps: CvEvaluationDeps,
): Promise<CvEvaluationOutcome> {
  if (!params.jdText.trim()) {
    return { ok: false, error: "Vui lòng dán mô tả công việc" };
  }

  const cv = await deps.findCv(params.cvId, params.userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  const prompt = buildEvaluationPrompt(cv, params.jdText);

  let result: EvaluationResult;
  try {
    result = await deps.requestEvaluation(prompt);
  } catch {
    return { ok: false, error: "AI đánh giá thất bại, vui lòng thử lại" };
  }

  const saved = await deps.saveEvaluation({
    cvId: params.cvId,
    userId: params.userId,
    jdText: params.jdText,
    jdTitle: params.jdTitle,
    jdCompany: params.jdCompany,
    result,
  });

  return { ok: true, evaluationId: saved.id, result };
}
