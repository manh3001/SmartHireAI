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
});
