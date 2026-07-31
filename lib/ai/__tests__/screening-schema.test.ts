import { describe, it, expect } from "vitest";
import { screeningResultSchema } from "../screening-schema";

describe("screeningResultSchema", () => {
  it("chấp nhận kết quả hợp lệ", () => {
    const r = screeningResultSchema.safeParse({
      ranking: [{ ref: 1, score: 80, shortlisted: true, reason: "mạnh" }],
      summary: "ok",
    });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu summary", () => {
    const r = screeningResultSchema.safeParse({ ranking: [] });
    expect(r.success).toBe(false);
  });

  it("từ chối score ngoài 0-100", () => {
    const r = screeningResultSchema.safeParse({
      ranking: [{ ref: 1, score: 150, shortlisted: false, reason: "x" }],
      summary: "s",
    });
    expect(r.success).toBe(false);
  });
});
