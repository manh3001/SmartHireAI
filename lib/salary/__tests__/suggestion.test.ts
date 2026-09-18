import { describe, it, expect } from "vitest";
import { computeSalarySuggestion } from "../suggestion";

const M = 1_000_000;
function row(category: string | null, level: string | null, min: number | null, max: number | null) {
  return { category, experienceLevel: level, salaryMin: min == null ? null : min * M, salaryMax: max == null ? null : max * M };
}

describe("computeSalarySuggestion", () => {
  it("dùng category_level khi đủ mẫu (>=3)", () => {
    const rows = [
      row("it", "JUNIOR", 10, 20), row("it", "JUNIOR", 12, 24), row("it", "JUNIOR", 14, 28),
      row("finance", "SENIOR", 30, 40),
    ];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("category_level");
    expect(s.sampleSize).toBe(3);
    expect(s.medianMin).toBe(12 * M);
    expect(s.medianMax).toBe(24 * M);
  });

  it("fallback sang category khi category_level thiếu mẫu", () => {
    const rows = [
      row("it", "JUNIOR", 10, 20),
      row("it", "SENIOR", 30, 50), row("it", "MID", 20, 30),
    ];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("category");
    expect(s.sampleSize).toBe(3);
  });

  it("fallback sang level khi ngành thiếu nhưng cấp đủ", () => {
    const rows = [
      row("finance", "JUNIOR", 8, 12), row("design", "JUNIOR", 9, 13), row("hr", "JUNIOR", 10, 14),
      row("it", "SENIOR", 40, 60),
    ];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("level");
  });

  it("fallback overall khi cả ngành lẫn cấp đều thiếu", () => {
    const rows = [row("finance", "SENIOR", 30, 40), row("design", "MID", 15, 25), row("hr", "LEAD", 40, 55)];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("overall");
  });

  it("null khi không có tin nào có lương", () => {
    const rows = [row("it", "JUNIOR", null, null)];
    expect(computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })).toBeNull();
  });

  it("ít dữ liệu (<3) vẫn trả overall với sampleSize nhỏ", () => {
    const rows = [row("it", "JUNIOR", 10, 20)];
    const s = computeSalarySuggestion(rows, { category: "marketing-sales", experienceLevel: "SENIOR" })!;
    expect(s.basis).toBe("overall");
    expect(s.sampleSize).toBe(1);
  });
});
