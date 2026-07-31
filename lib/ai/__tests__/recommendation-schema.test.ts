import { describe, it, expect } from "vitest";
import { recommendationResultSchema } from "../recommendation-schema";

describe("recommendationResultSchema", () => {
  it("chấp nhận kết quả hợp lệ", () => {
    const r = recommendationResultSchema.safeParse({
      ranking: [{ ref: 1, score: 85, reason: "hợp" }],
      summary: "ok",
    });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu summary", () => {
    const r = recommendationResultSchema.safeParse({ ranking: [] });
    expect(r.success).toBe(false);
  });

  it("từ chối score ngoài 0-100", () => {
    const r = recommendationResultSchema.safeParse({
      ranking: [{ ref: 1, score: -5, reason: "x" }],
      summary: "s",
    });
    expect(r.success).toBe(false);
  });
});
