import { describe, it, expect } from "vitest";
import { reviewSchema, summarizeReviews, canReview } from "../reviews";

describe("reviewSchema", () => {
  it("chấp nhận rating 1-5 và comment rỗng", () => {
    expect(reviewSchema.safeParse({ rating: 5, comment: "" }).success).toBe(true);
  });
  it("coerce chuỗi số '4' -> 4", () => {
    const r = reviewSchema.safeParse({ rating: "4", comment: "ổn" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rating).toBe(4);
  });
  it("từ chối rating ngoài 1-5", () => {
    expect(reviewSchema.safeParse({ rating: 0, comment: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 6, comment: "" }).success).toBe(false);
  });
  it("từ chối comment quá 1000 ký tự", () => {
    expect(reviewSchema.safeParse({ rating: 3, comment: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("summarizeReviews", () => {
  it("rỗng -> average 0, count 0", () => {
    expect(summarizeReviews([])).toEqual({ average: 0, count: 0 });
  });
  it("một phần tử", () => {
    expect(summarizeReviews([4])).toEqual({ average: 4, count: 1 });
  });
  it("làm tròn 1 chữ số thập phân", () => {
    expect(summarizeReviews([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});

describe("canReview", () => {
  it("đã ứng tuyển và không phải chủ -> true", () => {
    expect(canReview({ hasApplied: true, isOwner: false })).toBe(true);
  });
  it("chưa ứng tuyển -> false", () => {
    expect(canReview({ hasApplied: false, isOwner: false })).toBe(false);
  });
  it("chủ công ty -> false", () => {
    expect(canReview({ hasApplied: true, isOwner: true })).toBe(false);
  });
});
