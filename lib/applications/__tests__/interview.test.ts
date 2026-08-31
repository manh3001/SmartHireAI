import { describe, it, expect, vi } from "vitest";
import { runScheduleInterview, type ScheduleInterviewDeps } from "../interview-logic";

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
