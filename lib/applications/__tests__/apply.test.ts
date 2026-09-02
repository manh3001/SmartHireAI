import { describe, it, expect, vi } from "vitest";
import { runApply, type ApplyDeps } from "../apply";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "A", headline: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "", summary: "" },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
  languages: [],
  certifications: [],
};

function deps(over: Partial<ApplyDeps> = {}): ApplyDeps {
  return {
    findPublicJob: vi.fn().mockResolvedValue({ id: "job_1" }),
    findExistingApplication: vi.fn().mockResolvedValue(null),
    findCandidateCv: vi.fn().mockResolvedValue(cv),
    createApplication: vi.fn().mockResolvedValue({ id: "app_1" }),
    ...over,
  };
}

const params = {
  jobId: "job_1",
  candidateId: "u_1",
  cvId: "cv_1",
  coverLetter: "xin chào",
};

describe("runApply", () => {
  it("nộp đơn thành công, truyền snapshot CV, không kèm evaluationId", async () => {
    const d = deps();
    const r = await runApply(params, d);
    expect(r).toEqual({ ok: true, applicationId: "app_1" });
    expect(d.createApplication).toHaveBeenCalledWith({
      jobId: "job_1",
      candidateId: "u_1",
      cvId: "cv_1",
      cvSnapshot: cv,
      coverLetter: "xin chào",
    });
  });

  it("báo lỗi khi job không tồn tại/không công khai", async () => {
    const r = await runApply(params, deps({ findPublicJob: vi.fn().mockResolvedValue(null) }));
    expect(r).toEqual({ ok: false, error: "Không tìm thấy tin tuyển dụng" });
  });

  it("chặn nộp trùng", async () => {
    const r = await runApply(
      params,
      deps({ findExistingApplication: vi.fn().mockResolvedValue({ id: "app_x" }) }),
    );
    expect(r).toEqual({ ok: false, error: "Bạn đã ứng tuyển tin này" });
  });

  it("báo lỗi khi không tìm thấy CV của ứng viên", async () => {
    const r = await runApply(params, deps({ findCandidateCv: vi.fn().mockResolvedValue(null) }));
    expect(r).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });
});
