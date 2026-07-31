import { z } from "zod";

export const recommendationResultSchema = z.object({
  ranking: z.array(
    z.object({
      ref: z.number().int(),
      score: z.number().int().min(0).max(100),
      reason: z.string(),
    }),
  ),
  summary: z.string(),
});

export type RecommendationResult = z.infer<typeof recommendationResultSchema>;
