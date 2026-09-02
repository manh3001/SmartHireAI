import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "../chat";
import type { CvInput } from "@/lib/cv/types";
import type { EvaluationResult } from "../schema";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "Nguyễn Văn A", headline: "Frontend Dev", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "", summary: "Yêu code" },
  experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "web" }],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
  languages: [],
  certifications: [],
};

const evalResult: EvaluationResult = {
  overallScore: 75,
  strengths: ["React tốt"],
  weaknesses: ["Thiếu backend"],
  matchedKeywords: [],
  missingKeywords: [],
  skillGaps: [{ skill: "Node.js", why: "x", howToLearn: "y" }],
  summary: "ổn",
};

describe("buildChatSystemPrompt", () => {
  it("chua vai tro tu van + thong tin CV", () => {
    const p = buildChatSystemPrompt(cv);
    expect(p.toLowerCase()).toContain("tư vấn");
    expect(p).toContain("Nguyễn Văn A");
    expect(p).toContain("React");
  });

  it("them ket qua danh gia khi co", () => {
    const p = buildChatSystemPrompt(cv, evalResult);
    expect(p).toContain("75");
    expect(p).toContain("Node.js");
  });

  it("khong loi khi khong co danh gia", () => {
    const p = buildChatSystemPrompt(cv);
    expect(p).not.toContain("KẾT QUẢ ĐÁNH GIÁ");
  });
});
