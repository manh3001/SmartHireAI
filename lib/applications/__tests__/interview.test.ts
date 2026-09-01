import { describe, it, expect, vi } from "vitest";
import {
  runScheduleInterview,
  runCancelInterview,
  runSaveOutcome,
  type ScheduleInterviewDeps,
  type CancelInterviewDeps,
  type SaveOutcomeDeps,
} from "../interview-logic";

const mockData = {
  scheduledAt: new Date("2026-09-10T09:00:00"),
  location: "Hà Nội",
  meetingLink: "",
  note: "Phỏng vấn kỹ thuật",
};

function deps(over: Partial<ScheduleInterviewDeps> = {}): ScheduleInterviewDeps {
  return {
    findApplicationForRecruiter: vi
      .fn()
      .mockResolvedValue({ id: "app_1", candidateId: "c_1" }),
    upsertInterview: vi.fn().mockResolvedValue(undefined),
    notifyCandidate: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runScheduleInterview", () => {
  it("happy path: lưu lịch + gửi thông báo ứng viên", async () => {
    const d = deps();
    const r = await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.upsertInterview).toHaveBeenCalledWith("app_1", mockData);
    expect(d.notifyCandidate).toHaveBeenCalledWith(
      "c_1",
      expect.stringContaining("NTD A"),
      "/applications",
    );
  });

  it("từ chối nếu NTD không phải chủ job", async () => {
    const r = await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      deps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) }),
    );
    expect(r).toEqual({ ok: false, error: "Không tìm thấy đơn ứng tuyển" });
  });

  it("thông báo thất bại không làm hỏng kết quả", async () => {
    const d = deps({
      notifyCandidate: vi.fn().mockRejectedValue(new Error("push failed")),
    });
    const r = await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.upsertInterview).toHaveBeenCalled();
  });

  it("thông báo chứa ngày giờ đúng định dạng vi-VN", async () => {
    const d = deps();
    await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      d,
    );
    const [, msg] = (d.notifyCandidate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toContain("10");  // day 10
  });
});

function cancelDeps(over: Partial<CancelInterviewDeps> = {}): CancelInterviewDeps {
  return {
    findApplicationForRecruiter: vi.fn().mockResolvedValue({ id: "app_1", candidateId: "c_1" }),
    deleteInterview: vi.fn().mockResolvedValue(undefined),
    notifyCandidate: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runCancelInterview", () => {
  it("huỷ + thông báo ứng viên", async () => {
    const d = cancelDeps();
    const r = await runCancelInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A" },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.deleteInterview).toHaveBeenCalledWith("app_1");
    expect(d.notifyCandidate).toHaveBeenCalledWith(
      "c_1",
      expect.stringContaining("huỷ"),
      "/applications",
    );
  });

  it("từ chối nếu không phải chủ job", async () => {
    const d = cancelDeps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) });
    const r = await runCancelInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A" },
      d,
    );
    expect(r).toEqual({ ok: false, error: "Không tìm thấy đơn ứng tuyển" });
    expect(d.deleteInterview).not.toHaveBeenCalled();
  });

  it("notify lỗi không làm hỏng kết quả", async () => {
    const d = cancelDeps({ notifyCandidate: vi.fn().mockRejectedValue(new Error("x")) });
    const r = await runCancelInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A" },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.deleteInterview).toHaveBeenCalled();
  });
});

function outcomeDeps(over: Partial<SaveOutcomeDeps> = {}): SaveOutcomeDeps {
  return {
    findApplicationForRecruiter: vi.fn().mockResolvedValue({ id: "app_1" }),
    updateOutcome: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runSaveOutcome", () => {
  it("lưu kết quả (trim)", async () => {
    const d = outcomeDeps();
    const r = await runSaveOutcome(
      { applicationId: "app_1", recruiterId: "r_1", outcome: "  Làm tốt  " },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.updateOutcome).toHaveBeenCalledWith("app_1", "Làm tốt");
  });

  it("từ chối nếu không phải chủ job", async () => {
    const d = outcomeDeps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) });
    const r = await runSaveOutcome(
      { applicationId: "app_1", recruiterId: "r_1", outcome: "x" },
      d,
    );
    expect(r).toEqual({ ok: false, error: "Không tìm thấy đơn ứng tuyển" });
    expect(d.updateOutcome).not.toHaveBeenCalled();
  });

  it("cắt tối đa 1000 ký tự", async () => {
    const d = outcomeDeps();
    await runSaveOutcome(
      { applicationId: "app_1", recruiterId: "r_1", outcome: "a".repeat(1500) },
      d,
    );
    const [, saved] = (d.updateOutcome as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(saved.length).toBe(1000);
  });
});
