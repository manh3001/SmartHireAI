import { z } from "zod";

export const mockQuestionsSchema = z.object({
  questions: z.array(z.string()).min(1),
});
export type MockQuestions = z.infer<typeof mockQuestionsSchema>;

export const mockScoringSchema = z.object({
  perAnswer: z.array(
    z.object({
      score: z.number().min(0).max(10),
      feedback: z.string(),
    }),
  ),
  overall: z.object({
    score: z.number().min(0).max(100),
    summary: z.string(),
    tips: z.array(z.string()),
  }),
});
export type MockScoring = z.infer<typeof mockScoringSchema>;
