import { describe, it, expect, vi } from "vitest";
import { runRecommendations, type RunRecommendationsDeps, type RecommendationJobInput } from "../recommendations";
import type { CvInput } from "@/lib/cv/types";
import type { RecommendationResult } from "@/lib/ai/recommendation-schema";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "An", headline: "", email: "", phone: "", summary: "" },
  experiences: [], educations: [], skills: [], projects: [],
};

function job(id: string, title: string): RecommendationJobInput {
  return { jobId: id, title, company: "C", rawText: "jd" };
}

function deps(ai: RecommendationResult, over: Partial<RunRecommendationsDeps> = {}): RunRecommendationsDeps {
  return { requestRecommendations: vi.fn().mockResolvedValue(ai), ...over };
}

describe("runRecommendations", () => {
  it("báo lỗi khi không có tin", async () => {
    const d = deps({ ranking: [], summary: "" });
    const r = await runRecommendations({ cv, jobs: [] }, d);
    expect(r).toEqual({ ok: false, error: "Chưa có tin phù hợp để gợi ý" });
    expect(d.requestRecommendations).not.toHaveBeenCalled();
  });

  it("map ref -> job theo thứ tự, bỏ ref lỗi/trùng, bỏ tin không xếp hạng", async () => {
    const jobs = [job("j1", "A"), job("j2", "B"), job("j3", "C")];
    const ai: RecommendationResult = {
      ranking: [
        { ref: 2, score: 90, reason: "hợp" },
        { ref: 9, score: 50, reason: "ngoài phạm vi" },
        { ref: 2, score: 10, reason: "trùng" },
        { ref: 1, score: 70, reason: "khá" },
      ],
      summary: "tổng quan",
    };
    const r = await runRecommendations({ cv, jobs }, deps(ai));
    expect(r).toEqual({
      ok: true,
      summary: "tổng quan",
      items: [
        { jobId: "j2", title: "B", company: "C", score: 90, reason: "hợp" },
        { jobId: "j1", title: "A", company: "C", score: 70, reason: "khá" },
      ],
    });
  });

  it("báo lỗi mềm khi AI thất bại", async () => {
    const d = deps({ ranking: [], summary: "" }, {
      requestRecommendations: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const r = await runRecommendations({ cv, jobs: [job("j1", "A")] }, d);
    expect(r).toEqual({ ok: false, error: "AI gợi ý thất bại, vui lòng thử lại" });
  });
});
