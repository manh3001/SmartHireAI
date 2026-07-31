import { describe, it, expect } from "vitest";
import { buildRecommendationPrompt } from "../recommendation-prompt";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "An", headline: "Frontend Dev", email: "", phone: "", summary: "" },
  experiences: [],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
};

describe("buildRecommendationPrompt", () => {
  it("kèm CV và đánh số từng tin", () => {
    const p = buildRecommendationPrompt(cv, [
      { title: "Frontend", company: "A", rawText: "Cần React" },
      { title: "Backend", company: "B", rawText: "Cần Node" },
    ]);
    expect(p).toContain("An");
    expect(p).toContain("React");
    expect(p).toContain("#1");
    expect(p).toContain("Frontend");
    expect(p).toContain("#2");
    expect(p).toContain("Backend");
  });
});
