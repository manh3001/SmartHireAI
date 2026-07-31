import type { CvInput } from "@/lib/cv/types";
import { buildScreeningPrompt } from "@/lib/ai/screening-prompt";
import type { ScreeningResult } from "@/lib/ai/screening-schema";

export const MAX_SCREENING_APPLICANTS = 20;

export type ScreeningApplicantInput = {
  applicationId: string;
  candidateName: string;
  cv: CvInput;
  score: number | null;
};

export type ScreeningResultItem = {
  applicationId: string;
  candidateName: string;
  score: number | null;
  shortlisted: boolean;
  reason: string;
};

export type RunScreeningParams = {
  jobId: string;
  jdText: string;
  applicants: ScreeningApplicantInput[];
};

export type RunScreeningDeps = {
  requestScreening: (prompt: string) => Promise<ScreeningResult>;
  saveScreening: (data: {
    jobId: string;
    summary: string;
    result: ScreeningResultItem[];
    rawModelOutput: ScreeningResult;
  }) => Promise<void>;
};

export type RunScreeningOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function runScreening(
  params: RunScreeningParams,
  deps: RunScreeningDeps,
): Promise<RunScreeningOutcome> {
  if (params.applicants.length === 0) {
    return { ok: false, error: "Chưa có ứng viên để sàng lọc" };
  }

  const prompt = buildScreeningPrompt(
    params.jdText,
    params.applicants.map((a) => a.cv),
  );

  let ai: ScreeningResult;
  try {
    ai = await deps.requestScreening(prompt);
  } catch {
    return { ok: false, error: "AI sàng lọc thất bại, vui lòng thử lại" };
  }

  const n = params.applicants.length;
  const seen = new Set<number>();
  const result: ScreeningResultItem[] = [];

  for (const r of ai.ranking) {
    const idx = r.ref - 1;
    if (idx < 0 || idx >= n) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    const a = params.applicants[idx];
    result.push({
      applicationId: a.applicationId,
      candidateName: a.candidateName,
      score: r.score,
      shortlisted: r.shortlisted,
      reason: r.reason,
    });
  }

  params.applicants.forEach((a, idx) => {
    if (!seen.has(idx)) {
      result.push({
        applicationId: a.applicationId,
        candidateName: a.candidateName,
        score: null,
        shortlisted: false,
        reason: "Chưa được AI xếp hạng",
      });
    }
  });

  await deps.saveScreening({
    jobId: params.jobId,
    summary: ai.summary,
    result,
    rawModelOutput: ai,
  });

  return { ok: true };
}
