import { describe, it, expect } from "vitest";
import { buildJobPostingJsonLd, type JobPostingInput } from "../job-jsonld";

const base: JobPostingInput = {
  title: "Frontend Developer",
  company: "ACME",
  rawText: "Cần React và TypeScript",
  location: "Hà Nội",
  employmentType: "FULL_TIME",
  salaryMin: 15000000,
  salaryMax: 25000000,
  createdAt: new Date("2026-09-01T00:00:00Z"),
};

describe("buildJobPostingJsonLd", () => {
  it("có đủ field bắt buộc của JobPosting", () => {
    const ld = buildJobPostingJsonLd(base, "https://smarthire.vn/jobs/x");
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.title).toBe("Frontend Developer");
    expect(ld.description).toBe("Cần React và TypeScript");
    expect(ld.datePosted).toBe("2026-09-01T00:00:00.000Z");
    expect(ld.hiringOrganization).toMatchObject({ "@type": "Organization", name: "ACME" });
    expect(ld.jobLocation).toMatchObject({ address: { addressCountry: "VN", addressLocality: "Hà Nội" } });
    expect(ld.url).toBe("https://smarthire.vn/jobs/x");
    expect(ld.directApply).toBe(true);
  });

  it("map employmentType sang chuẩn Google", () => {
    const ld = buildJobPostingJsonLd({ ...base, employmentType: "INTERNSHIP" }, "u");
    expect(ld.employmentType).toBe("INTERN");
  });

  it("có baseSalary khi có lương", () => {
    const ld = buildJobPostingJsonLd(base, "u");
    expect(ld.baseSalary).toMatchObject({
      currency: "VND",
      value: { minValue: 15000000, maxValue: 25000000, unitText: "MONTH" },
    });
  });

  it("bỏ baseSalary khi cả hai lương null", () => {
    const ld = buildJobPostingJsonLd({ ...base, salaryMin: null, salaryMax: null }, "u");
    expect(ld.baseSalary).toBeUndefined();
  });

  it("bỏ employmentType khi null", () => {
    const ld = buildJobPostingJsonLd({ ...base, employmentType: null }, "u");
    expect(ld.employmentType).toBeUndefined();
  });
});
