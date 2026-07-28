import { describe, it, expect } from "vitest";
import { evaluationResultSchema } from "../schema";

const valid = {
  overallScore: 75,
  strengths: ["React tốt"],
  weaknesses: ["Thiếu backend"],
  matchedKeywords: ["React"],
  missingKeywords: ["Node"],
  skillGaps: [{ skill: "Node", why: "JD yêu cầu", howToLearn: "Học trên MDN" }],
  summary: "Khá phù hợp",
};

describe("evaluationResultSchema", () => {
  it("chap nhan ket qua hop le", () => {
    expect(evaluationResultSchema.safeParse(valid).success).toBe(true);
  });

  it("tu choi khi thieu summary", () => {
    const { summary, ...rest } = valid;
    expect(evaluationResultSchema.safeParse(rest).success).toBe(false);
  });

  it("tu choi diem ngoai 0-100", () => {
    expect(evaluationResultSchema.safeParse({ ...valid, overallScore: 120 }).success).toBe(false);
  });

  it("tu choi skillGap thieu howToLearn", () => {
    const bad = { ...valid, skillGaps: [{ skill: "Node", why: "x" }] };
    expect(evaluationResultSchema.safeParse(bad).success).toBe(false);
  });
});
