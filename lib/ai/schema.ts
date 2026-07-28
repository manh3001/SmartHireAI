import { z } from "zod";

export const evaluationResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  skillGaps: z.array(
    z.object({
      skill: z.string(),
      why: z.string(),
      howToLearn: z.string(),
    }),
  ),
  summary: z.string(),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
