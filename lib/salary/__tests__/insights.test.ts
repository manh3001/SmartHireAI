import { describe, it, expect } from "vitest";
import { median, computeSalaryInsights } from "../insights";

const M = 1_000_000;

describe("median", () => {
  it("rỗng -> null", () => {
    expect(median([])).toBeNull();
  });
  it("1 phần tử", () => {
    expect(median([5])).toBe(5);
  });
  it("lẻ -> phần tử giữa (không phụ thuộc thứ tự đầu vào)", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("chẵn -> trung bình 2 phần tử giữa", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("computeSalaryInsights", () => {
  it("gom theo ngành, tính median min/max + sampleSize", () => {
    const rows = [
      { category: "it", salaryMin: 10 * M, salaryMax: 20 * M },
      { category: "it", salaryMin: 20 * M, salaryMax: 40 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      category: "it",
      label: "Công nghệ thông tin",
      sampleSize: 2,
      medianMin: 15 * M,
      medianMax: 30 * M,
    });
  });

  it("tin chỉ-min hoặc chỉ-max: sampleSize đếm cả hai; median theo từng cột", () => {
    const rows = [
      { category: "design", salaryMin: 10 * M, salaryMax: null },
      { category: "design", salaryMin: null, salaryMax: 30 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out[0].sampleSize).toBe(2);
    expect(out[0].medianMin).toBe(10 * M);
    expect(out[0].medianMax).toBe(30 * M);
  });

  it("category không nhận dạng/null -> gom vào 'other' (Khác)", () => {
    const rows = [
      { category: "xyz", salaryMin: 10 * M, salaryMax: null },
      { category: null, salaryMin: 12 * M, salaryMax: null },
    ];
    const out = computeSalaryInsights(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ category: "other", label: "Khác", sampleSize: 2 });
  });

  it("bỏ tin không có cả min lẫn max (thỏa thuận)", () => {
    const rows = [
      { category: "it", salaryMin: null, salaryMax: null },
      { category: "it", salaryMin: 10 * M, salaryMax: 20 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out[0].sampleSize).toBe(1);
  });

  it("sắp theo medianMax giảm dần", () => {
    const rows = [
      { category: "hr", salaryMin: null, salaryMax: 15 * M },
      { category: "finance", salaryMin: null, salaryMax: 50 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out.map((o) => o.category)).toEqual(["finance", "hr"]);
  });
});
