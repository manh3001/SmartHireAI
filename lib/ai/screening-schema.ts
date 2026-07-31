import { z } from "zod";

export const screeningResultSchema = z.object({
  ranking: z.array(
    z.object({
      ref: z.number().int(),
      score: z.number().int().min(0).max(100),
      shortlisted: z.boolean(),
      reason: z.string(),
    }),
  ),
  summary: z.string(),
});

export type ScreeningResult = z.infer<typeof screeningResultSchema>;
