import { describe, it, expect, vi } from "vitest";
import { runCvEvaluation } from "../evaluate";
import type { EvaluationResult } from "../schema";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "A", headline: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "", summary: "" },
  experiences: [], educations: [], skills: [], projects: [], languages: [], certifications: [],
};

const result: EvaluationResult = {
  overallScore: 80, strengths: [], weaknesses: [],
  matchedKeywords: [], missingKeywords: [], skillGaps: [], summary: "ok",
};

const deps = () => ({
  findCv: vi.fn().mockResolvedValue(cv),
  requestEvaluation: vi.fn().mockResolvedValue(result),
  saveEvaluation: vi.fn().mockResolvedValue({ id: "ev1" }),
});

const params = { cvId: "c1", userId: "u1", jdText: "Cần React", jdTitle: "Dev", jdCompany: "FPT" };

describe("runCvEvaluation", () => {
  it("danh gia thanh cong, luu ket qua", async () => {
    const d = deps();
    const r = await runCvEvaluation(params, d);
    expect(r).toEqual({ ok: true, evaluationId: "ev1", result });
    expect(d.saveEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ cvId: "c1", userId: "u1", result }),
    );
  });

  it("tu choi khi JD rong", async () => {
    const d = deps();
    const r = await runCvEvaluation({ ...params, jdText: "   " }, d);
    expect(r.ok).toBe(false);
    expect(d.requestEvaluation).not.toHaveBeenCalled();
  });

  it("bao loi khi khong tim thay CV", async () => {
    const d = deps();
    d.findCv.mockResolvedValue(null);
    const r = await runCvEvaluation(params, d);
    expect(r).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("bao loi khi model that bai", async () => {
    const d = deps();
    d.requestEvaluation.mockRejectedValue(new Error("boom"));
    const r = await runCvEvaluation(params, d);
    expect(r.ok).toBe(false);
    expect(d.saveEvaluation).not.toHaveBeenCalled();
  });
});
