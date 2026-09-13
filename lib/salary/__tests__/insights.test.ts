import { describe, it, expect } from "vitest";
import { median, computeSalaryInsights, computeSalaryByLevel, computeSalaryBySkill, computeSalaryMatrix } from "../insights";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/jobs/job-fields";
import { JOB_CATEGORY_LABELS } from "@/lib/jobs/job-categories";

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

describe("computeSalaryByLevel", () => {
  it("gom theo cấp, sắp theo thứ tự cấp bậc (không theo median)", () => {
    const rows = [
      { experienceLevel: "SENIOR", salaryMin: null, salaryMax: 50 * M },
      { experienceLevel: "INTERN", salaryMin: null, salaryMax: 10 * M },
    ];
    const out = computeSalaryByLevel(rows);
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe(EXPERIENCE_LEVEL_LABELS.INTERN);
    expect(out[0].medianMax).toBe(10 * M);
    expect(out[1].label).toBe(EXPERIENCE_LEVEL_LABELS.SENIOR);
  });

  it("bỏ tin cấp bậc null/không hợp lệ và tin không có lương", () => {
    const rows = [
      { experienceLevel: null, salaryMin: 10 * M, salaryMax: null },
      { experienceLevel: "XXX", salaryMin: 10 * M, salaryMax: null },
      { experienceLevel: "MID", salaryMin: null, salaryMax: null },
      { experienceLevel: "MID", salaryMin: 20 * M, salaryMax: 30 * M },
    ];
    const out = computeSalaryByLevel(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: EXPERIENCE_LEVEL_LABELS.MID, sampleSize: 1, medianMin: 20 * M, medianMax: 30 * M });
  });
});

describe("computeSalaryBySkill", () => {
  it("tách + dedupe trong tin, gộp không phân biệt hoa thường", () => {
    const rows = [
      { skills: "React, React, node", salaryMin: null, salaryMax: 30 * M },
      { skills: "REACT", salaryMin: null, salaryMax: 40 * M },
      { skills: "react", salaryMin: null, salaryMax: 50 * M },
    ];
    const out = computeSalaryBySkill(rows);
    const react = out.find((r) => r.label.toLowerCase() === "react");
    expect(react?.sampleSize).toBe(3);
    expect(react?.label).toBe("React"); // dạng hiển thị lần đầu
  });

  it("loại kỹ năng dưới ngưỡng mẫu (>=3)", () => {
    const rows = [
      { skills: "Go", salaryMin: null, salaryMax: 40 * M },
      { skills: "Go", salaryMin: null, salaryMax: 40 * M },
    ];
    expect(computeSalaryBySkill(rows)).toEqual([]);
  });

  it("sắp theo medianMax giảm dần và cắt theo limit", () => {
    const rows = [
      { skills: "A", salaryMin: null, salaryMax: 10 * M },
      { skills: "A", salaryMin: null, salaryMax: 10 * M },
      { skills: "A", salaryMin: null, salaryMax: 10 * M },
      { skills: "B", salaryMin: null, salaryMax: 90 * M },
      { skills: "B", salaryMin: null, salaryMax: 90 * M },
      { skills: "B", salaryMin: null, salaryMax: 90 * M },
    ];
    const out = computeSalaryBySkill(rows, 1);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("B");
  });
});

describe("computeSalaryMatrix", () => {
  it("levels đúng thứ tự INTERN->LEAD; rỗng -> không hàng", () => {
    const m = computeSalaryMatrix([]);
    expect(m.levels.map((l) => l.level)).toEqual(["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"]);
    expect(m.rows).toEqual([]);
  });

  it("gom theo ngành×cấp, median rep = salaryMax ?? salaryMin; ô rỗng = null", () => {
    const rows = [
      { category: "it", experienceLevel: "SENIOR", salaryMin: null, salaryMax: 40 * M },
      { category: "it", experienceLevel: "SENIOR", salaryMin: 20 * M, salaryMax: null },
    ];
    const m = computeSalaryMatrix(rows);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].label).toBe(JOB_CATEGORY_LABELS.it);
    const seniorIdx = m.levels.findIndex((l) => l.level === "SENIOR");
    const internIdx = m.levels.findIndex((l) => l.level === "INTERN");
    expect(m.rows[0].cells[seniorIdx]).toBe(30 * M);
    expect(m.rows[0].cells[internIdx]).toBeNull();
  });

  it("loại tin cấp bậc null/không hợp lệ + tin không lương; ngành lạ -> Khác", () => {
    const rows = [
      { category: "xyz", experienceLevel: "MID", salaryMin: null, salaryMax: 25 * M },
      { category: "it", experienceLevel: null, salaryMin: 10 * M, salaryMax: null },
      { category: "it", experienceLevel: "MID", salaryMin: null, salaryMax: null },
    ];
    const m = computeSalaryMatrix(rows);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].label).toBe(JOB_CATEGORY_LABELS.other);
    const midIdx = m.levels.findIndex((l) => l.level === "MID");
    expect(m.rows[0].cells[midIdx]).toBe(25 * M);
  });
});
