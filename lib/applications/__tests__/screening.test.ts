import { describe, it, expect, vi } from "vitest";
import { runScreening, type RunScreeningDeps, type ScreeningApplicantInput } from "../screening";
import type { CvInput } from "@/lib/cv/types";
import type { ScreeningResult } from "@/lib/ai/screening-schema";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "x", headline: "", email: "", phone: "", summary: "" },
  experiences: [], educations: [], skills: [], projects: [],
};

function applicant(id: string, name: string, score: number | null): ScreeningApplicantInput {
  return { applicationId: id, candidateName: name, cv, score };
}

function deps(ai: ScreeningResult, over: Partial<RunScreeningDeps> = {}): RunScreeningDeps {
  return {
    requestScreening: vi.fn().mockResolvedValue(ai),
    saveScreening: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runScreening", () => {
  it("báo lỗi khi không có ứng viên", async () => {
    const d = deps({ ranking: [], summary: "" });
    const r = await runScreening({ jobId: "j", jdText: "jd", applicants: [] }, d);
    expect(r).toEqual({ ok: false, error: "Chưa có ứng viên để sàng lọc" });
    expect(d.requestScreening).not.toHaveBeenCalled();
  });

  it("map ref -> application theo đúng thứ tự, bỏ ref ngoài phạm vi và trùng", async () => {
    const applicants = [applicant("a1", "An", 50), applicant("a2", "Bình", 60), applicant("a3", "Cường", 70)];
    const ai: ScreeningResult = {
      ranking: [
        { ref: 2, score: 90, shortlisted: true, reason: "tốt" },
        { ref: 5, score: 80, shortlisted: false, reason: "ngoài phạm vi" },
        { ref: 2, score: 10, shortlisted: false, reason: "trùng" },
        { ref: 1, score: 70, shortlisted: true, reason: "khá" },
      ],
      summary: "tổng quan",
    };
    const d = deps(ai);
    const r = await runScreening({ jobId: "j", jdText: "jd", applicants }, d);
    expect(r).toEqual({ ok: true });
    expect(d.saveScreening).toHaveBeenCalledWith({
      jobId: "j",
      summary: "tổng quan",
      rawModelOutput: ai,
      result: [
        { applicationId: "a2", candidateName: "Bình", score: 90, shortlisted: true, reason: "tốt" },
        { applicationId: "a1", candidateName: "An", score: 70, shortlisted: true, reason: "khá" },
        { applicationId: "a3", candidateName: "Cường", score: null, shortlisted: false, reason: "Chưa được AI xếp hạng" },
      ],
    });
  });

  it("báo lỗi mềm khi AI thất bại", async () => {
    const d = deps({ ranking: [], summary: "" }, {
      requestScreening: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const r = await runScreening(
      { jobId: "j", jdText: "jd", applicants: [applicant("a1", "An", 1)] },
      d,
    );
    expect(r).toEqual({ ok: false, error: "AI sàng lọc thất bại, vui lòng thử lại" });
    expect(d.saveScreening).not.toHaveBeenCalled();
  });
});
