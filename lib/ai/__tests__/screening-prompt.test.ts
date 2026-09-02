import { describe, it, expect } from "vitest";
import { buildScreeningPrompt } from "../screening-prompt";
import type { CvInput } from "@/lib/cv/types";

const cv = (name: string): CvInput => ({
  title: "CV",
  profile: { fullName: name, headline: "Dev", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "", summary: "" },
  experiences: [],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
  languages: [],
  certifications: [],
});

describe("buildScreeningPrompt", () => {
  it("đánh số từng ứng viên và kèm JD", () => {
    const p = buildScreeningPrompt("JD nội dung", [cv("An"), cv("Bình")]);
    expect(p).toContain("JD nội dung");
    expect(p).toContain("#1");
    expect(p).toContain("An");
    expect(p).toContain("#2");
    expect(p).toContain("Bình");
  });
});
