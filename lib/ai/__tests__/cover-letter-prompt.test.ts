import { describe, it, expect } from "vitest";
import { buildCoverLetterPrompt, COVER_LETTER_SYSTEM_PROMPT } from "../cover-letter-prompt";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: {
    fullName: "Nguyễn Văn A", headline: "Frontend Dev", email: "", phone: "",
    location: "", linkedin: "", github: "", portfolio: "", summary: "Yêu thích React",
  },
  experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "Làm web" }],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
  languages: [],
  certifications: [],
};

describe("buildCoverLetterPrompt", () => {
  it("chứa tên ứng viên, nội dung JD và dữ kiện CV", () => {
    const p = buildCoverLetterPrompt(cv, "Cần React và giao tiếp tốt", "Nguyễn Văn A");
    expect(p).toContain("Nguyễn Văn A");
    expect(p).toContain("Cần React và giao tiếp tốt");
    expect(p).toContain("FPT");
    expect(p).toContain("React");
  });
});

describe("COVER_LETTER_SYSTEM_PROMPT", () => {
  it("có chỉ dẫn độ dài và không bịa thông tin", () => {
    expect(COVER_LETTER_SYSTEM_PROMPT).toContain("150");
    expect(COVER_LETTER_SYSTEM_PROMPT.toLowerCase()).toContain("không bịa");
  });
});
