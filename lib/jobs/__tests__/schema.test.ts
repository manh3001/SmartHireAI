import { describe, it, expect } from "vitest";
import { jobSchema } from "../schema";

const base = {
  title: "Frontend",
  company: "ACME",
  rawText: "Mô tả",
  location: "Hà Nội",
  skills: "React",
  employmentType: "FULL_TIME",
  experienceLevel: "SENIOR",
  salaryMin: 15_000_000,
  salaryMax: 25_000_000,
  salaryNegotiable: false,
};

describe("jobSchema", () => {
  it("chấp nhận input hợp lệ", () => {
    const r = jobSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.employmentType).toBe("FULL_TIME");
      expect(r.data.experienceLevel).toBe("SENIOR");
    }
  });

  it("enum rỗng -> null", () => {
    const r = jobSchema.safeParse({ ...base, employmentType: "", experienceLevel: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.employmentType).toBeNull();
      expect(r.data.experienceLevel).toBeNull();
    }
  });

  it("thiếu title -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });

  it("thiếu rawText -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, rawText: "" }).success).toBe(false);
  });

  it("enum sai -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, employmentType: "BOGUS" }).success).toBe(false);
  });

  it("min > max -> lỗi", () => {
    const r = jobSchema.safeParse({ ...base, salaryMin: 30_000_000, salaryMax: 10_000_000 });
    expect(r.success).toBe(false);
  });

  it("lương âm -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, salaryMin: -1 }).success).toBe(false);
  });

  it("chỉ có một đầu lương vẫn hợp lệ", () => {
    expect(jobSchema.safeParse({ ...base, salaryMin: 15_000_000, salaryMax: null }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, salaryMin: null, salaryMax: 25_000_000 }).success).toBe(true);
  });

  it("không lương (null cả hai) vẫn hợp lệ", () => {
    const r = jobSchema.safeParse({ ...base, salaryMin: null, salaryMax: null, salaryNegotiable: true });
    expect(r.success).toBe(true);
  });
});
