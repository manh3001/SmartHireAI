import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export type ReviewSummary = { average: number; count: number };

// Trung bình làm tròn 1 chữ số thập phân; count = số review. Rỗng -> {0,0}.
export function summarizeReviews(ratings: number[]): ReviewSummary {
  if (ratings.length === 0) return { average: 0, count: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

// Đủ điều kiện đánh giá khi đã ứng tuyển và KHÔNG phải chủ công ty.
export function canReview({ hasApplied, isOwner }: { hasApplied: boolean; isOwner: boolean }): boolean {
  return hasApplied && !isOwner;
}
