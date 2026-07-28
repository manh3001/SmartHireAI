import { describe, it, expect } from "vitest";
import { buildEvaluationPrompt, SYSTEM_PROMPT } from "../prompt";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "Nguyễn Văn A", headline: "Dev", email: "", phone: "", summary: "Yêu code" },
  experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "Làm web" }],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
};

describe("buildEvaluationPrompt", () => {
  it("chua thong tin CV va JD", () => {
    const p = buildEvaluationPrompt(cv, "Cần React và Node");
    expect(p).toContain("Nguyễn Văn A");
    expect(p).toContain("FPT");
    expect(p).toContain("React");
    expect(p).toContain("Cần React và Node");
  });

  it("SYSTEM_PROMPT nhac vai tro chuyen gia tuyen dung", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("tuyển dụng");
  });
});
