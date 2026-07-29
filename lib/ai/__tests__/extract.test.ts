import { describe, it, expect } from "vitest";
import { cvExtractionSchema, buildExtractionPrompt, EXTRACTION_SYSTEM } from "../extract";

describe("cvExtractionSchema", () => {
  it("chap nhan du lieu day du", () => {
    const r = cvExtractionSchema.safeParse({
      title: "CV",
      profile: { fullName: "A", headline: "Dev", email: "a@b.com", phone: "0900", summary: "x" },
      experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "web" }],
      educations: [{ school: "BK", major: "CNTT", startDate: "2019", endDate: "2023" }],
      skills: [{ name: "React", level: "" }],
      projects: [{ name: "P", description: "d", tech: "React", link: "" }],
    });
    expect(r.success).toBe(true);
  });

  it("chap nhan khi trong rong (cho phep chuoi rong)", () => {
    const r = cvExtractionSchema.safeParse({
      title: "",
      profile: { fullName: "", headline: "", email: "", phone: "", summary: "" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
    });
    expect(r.success).toBe(true);
  });
});

describe("buildExtractionPrompt", () => {
  it("chua van ban dau vao + yeu cau JSON", () => {
    const p = buildExtractionPrompt("Nguyễn Văn A - Frontend Developer");
    expect(p).toContain("Nguyễn Văn A");
    expect(p.toLowerCase()).toContain("json");
  });

  it("EXTRACTION_SYSTEM nhac vai tro trich xuat", () => {
    expect(EXTRACTION_SYSTEM.toLowerCase()).toContain("trích xuất");
  });
});
