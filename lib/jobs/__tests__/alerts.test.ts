import { describe, it, expect } from "vitest";
import {
  matchesAlert,
  alertLabel,
  criteriaFromFilter,
  criteriaToQuery,
  type MatchableJob,
} from "../alerts";

const base: MatchableJob = {
  title: "Lập trình viên React",
  company: "FPT Software",
  rawText: "Cần React, TypeScript. Làm tại Hà Nội.",
  location: "Hà Nội",
  skills: "React, TS",
  category: "it",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  salaryMin: 20_000_000,
  salaryMax: 30_000_000,
};

describe("matchesAlert", () => {
  it("tiêu chí rỗng -> khớp mọi tin", () => {
    expect(matchesAlert(base, {})).toBe(true);
  });
  it("term khớp không phân biệt hoa/thường trên nhiều trường (kể cả location)", () => {
    expect(matchesAlert(base, { term: "react" })).toBe(true);
    expect(matchesAlert(base, { term: "hà nội" })).toBe(true);
    expect(matchesAlert(base, { term: "python" })).toBe(false);
  });
  it("category/employmentType/experienceLevel so bằng đúng", () => {
    expect(matchesAlert(base, { category: "it" })).toBe(true);
    expect(matchesAlert(base, { category: "design" })).toBe(false);
    expect(matchesAlert(base, { employmentType: "PART_TIME" })).toBe(false);
    expect(matchesAlert(base, { experienceLevel: "MID" })).toBe(true);
  });
  it("nhiều tiêu chí phải cùng đúng (AND)", () => {
    expect(matchesAlert(base, { term: "react", category: "it" })).toBe(true);
    expect(matchesAlert(base, { term: "react", category: "design" })).toBe(false);
  });
  it("salary: khớp khi salaryMax >= ngưỡng", () => {
    expect(matchesAlert(base, { salaryMillions: 25 })).toBe(true);
    expect(matchesAlert(base, { salaryMillions: 40 })).toBe(false);
  });
  it("salary: salaryMax null thì soi salaryMin (theo salaryWhere)", () => {
    const j = { ...base, salaryMax: null, salaryMin: 50_000_000 };
    expect(matchesAlert(j, { salaryMillions: 40 })).toBe(true);
    const j2 = { ...base, salaryMax: null, salaryMin: null };
    expect(matchesAlert(j2, { salaryMillions: 10 })).toBe(false);
  });
});

describe("alertLabel", () => {
  it("rỗng -> Tất cả việc làm", () => {
    expect(alertLabel({})).toBe("Tất cả việc làm");
  });
  it("nối các tiêu chí bằng ' · '", () => {
    expect(alertLabel({ term: "React", category: "it", employmentType: "FULL_TIME" }))
      .toBe("React · Công nghệ thông tin · Toàn thời gian");
  });
  it("gồm cấp bậc và lương", () => {
    expect(alertLabel({ experienceLevel: "SENIOR", salaryMillions: 30 }))
      .toBe("Senior · Từ 30 triệu");
  });
});

describe("criteriaFromFilter / criteriaToQuery", () => {
  it("bỏ term rỗng, giữ tiêu chí có mặt", () => {
    expect(criteriaFromFilter({ term: "  ", category: "it" })).toEqual({ category: "it" });
    expect(criteriaFromFilter({ term: "react", salaryMillions: 20 }))
      .toEqual({ term: "react", salaryMillions: 20 });
  });
  it("criteriaToQuery ánh xạ đúng key của /jobs", () => {
    expect(criteriaToQuery({ term: "react", category: "it", employmentType: "FULL_TIME", experienceLevel: "MID", salaryMillions: 20 }))
      .toEqual({ q: "react", category: "it", type: "FULL_TIME", level: "MID", salary: "20" });
    expect(criteriaToQuery({})).toEqual({});
  });
});
