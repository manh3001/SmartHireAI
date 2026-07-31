import type { CvInput } from "@/lib/cv/types";
import {
  buildRecommendationPrompt,
  type RecommendationJob,
} from "@/lib/ai/recommendation-prompt";
import type { RecommendationResult } from "@/lib/ai/recommendation-schema";

export const MAX_RECOMMEND_JOBS = 20;

export type RecommendationJobInput = {
  jobId: string;
  title: string;
  company: string;
  rawText: string;
};

export type RecommendationItem = {
  jobId: string;
  title: string;
  company: string;
  score: number;
  reason: string;
};

export type RunRecommendationsParams = {
  cv: CvInput;
  jobs: RecommendationJobInput[];
};

export type RunRecommendationsDeps = {
  requestRecommendations: (prompt: string) => Promise<RecommendationResult>;
};

export type RunRecommendationsOutcome =
  | { ok: true; summary: string; items: RecommendationItem[] }
  | { ok: false; error: string };

export async function runRecommendations(
  params: RunRecommendationsParams,
  deps: RunRecommendationsDeps,
): Promise<RunRecommendationsOutcome> {
  if (params.jobs.length === 0) {
    return { ok: false, error: "Chưa có tin phù hợp để gợi ý" };
  }

  const promptJobs: RecommendationJob[] = params.jobs.map((j) => ({
    title: j.title,
    company: j.company,
    rawText: j.rawText,
  }));
  const prompt = buildRecommendationPrompt(params.cv, promptJobs);

  let ai: RecommendationResult;
  try {
    ai = await deps.requestRecommendations(prompt);
  } catch {
    return { ok: false, error: "AI gợi ý thất bại, vui lòng thử lại" };
  }

  const n = params.jobs.length;
  const seen = new Set<number>();
  const items: RecommendationItem[] = [];

  for (const r of ai.ranking) {
    const idx = r.ref - 1;
    if (idx < 0 || idx >= n) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    const j = params.jobs[idx];
    items.push({
      jobId: j.jobId,
      title: j.title,
      company: j.company,
      score: r.score,
      reason: r.reason,
    });
  }

  return { ok: true, summary: ai.summary, items };
}
