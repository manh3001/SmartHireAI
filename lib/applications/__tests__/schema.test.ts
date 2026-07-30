import { describe, it, expect } from "vitest";
import { applySchema } from "../schema";

describe("applySchema", () => {
  it("chấp nhận cvId hợp lệ, coverLetter rỗng", () => {
    const r = applySchema.safeParse({ cvId: "cv_1", coverLetter: "" });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu cvId", () => {
    const r = applySchema.safeParse({ cvId: "", coverLetter: "hi" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Vui lòng chọn CV");
  });

  it("từ chối cover letter quá dài", () => {
    const r = applySchema.safeParse({ cvId: "cv_1", coverLetter: "x".repeat(3001) });
    expect(r.success).toBe(false);
  });
});
