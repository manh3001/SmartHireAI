import { describe, it, expect } from "vitest";
import { shapeRoleCounts, summarizeSalaries } from "../stats-shape";

describe("shapeRoleCounts", () => {
  it("đếm theo vai + total", () => {
    expect(
      shapeRoleCounts([
        { role: "CANDIDATE", count: 10 },
        { role: "RECRUITER", count: 4 },
        { role: "ADMIN", count: 1 },
      ]),
    ).toEqual({ candidates: 10, recruiters: 4, admins: 1, total: 15 });
  });
  it("vai vắng mặt = 0", () => {
    expect(shapeRoleCounts([{ role: "CANDIDATE", count: 2 }])).toEqual({
      candidates: 2, recruiters: 0, admins: 0, total: 2,
    });
  });
});

describe("summarizeSalaries", () => {
  it("bỏ JD không lương, trung điểm min-max", () => {
    const r = summarizeSalaries([
      { salaryMin: 10_000_000, salaryMax: 20_000_000 }, // mid 15M
      { salaryMin: null, salaryMax: null },
      { salaryMin: 30_000_000, salaryMax: null },        // mid 30M
    ]);
    expect(r.count).toBe(2);
    expect(r.avgMidpoint).toBe(22_500_000);
    expect(r.min).toBe(10_000_000);
    expect(r.max).toBe(30_000_000);
  });
  it("danh sách rỗng / toàn không lương -> count 0, các số null", () => {
    expect(summarizeSalaries([])).toEqual({ count: 0, avgMidpoint: null, min: null, max: null });
    expect(summarizeSalaries([{ salaryMin: null, salaryMax: null }])).toEqual({
      count: 0, avgMidpoint: null, min: null, max: null,
    });
  });
});
