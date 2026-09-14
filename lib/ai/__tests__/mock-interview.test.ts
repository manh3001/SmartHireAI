import { describe, it, expect } from "vitest";
import { mockQuestionsSchema, mockScoringSchema } from "../mock-interview-schema";
import { buildQuestionsPrompt, buildScoringPrompt, QUESTION_COUNT } from "../mock-interview-prompt";

const jd = { title: "Kỹ sư Backend", company: "ACME", rawText: "Node.js, PostgreSQL, 2 năm KN" };

describe("buildQuestionsPrompt", () => {
  it("chứa JD và số câu hỏi", () => {
    const p = buildQuestionsPrompt(jd);
    expect(p).toContain("Kỹ sư Backend");
    expect(p).toContain("ACME");
    expect(p).toContain("PostgreSQL");
    expect(p).toContain(String(QUESTION_COUNT));
  });
});

describe("buildScoringPrompt", () => {
  it("chứa từng câu hỏi + trả lời; trả lời trống -> (bỏ trống)", () => {
    const p = buildScoringPrompt(jd, [
      { question: "Giới thiệu bản thân", answer: "Tôi là dev" },
      { question: "Điểm yếu?", answer: "" },
    ]);
    expect(p).toContain("Giới thiệu bản thân");
    expect(p).toContain("Tôi là dev");
    expect(p).toContain("Điểm yếu?");
    expect(p).toContain("(bỏ trống)");
  });
});

describe("mockQuestionsSchema", () => {
  it("hợp lệ", () => {
    expect(mockQuestionsSchema.safeParse({ questions: ["a", "b"] }).success).toBe(true);
  });
  it("mảng rỗng -> lỗi", () => {
    expect(mockQuestionsSchema.safeParse({ questions: [] }).success).toBe(false);
  });
});

describe("mockScoringSchema", () => {
  it("hợp lệ", () => {
    const ok = {
      perAnswer: [{ score: 8, feedback: "Tốt" }],
      overall: { score: 75, summary: "Khá", tips: ["Nói rõ hơn"] },
    };
    expect(mockScoringSchema.safeParse(ok).success).toBe(true);
  });
  it("điểm ngoài khoảng -> lỗi", () => {
    const bad = {
      perAnswer: [{ score: 11, feedback: "x" }],
      overall: { score: 75, summary: "y", tips: [] },
    };
    expect(mockScoringSchema.safeParse(bad).success).toBe(false);
  });
});
