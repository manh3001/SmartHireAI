import { describe, it, expect, vi } from "vitest";
import { runChangeStatus, type ChangeStatusDeps } from "../transition";

function deps(over: Partial<ChangeStatusDeps> = {}): ChangeStatusDeps {
  return {
    findApplicationForRecruiter: vi
      .fn()
      .mockResolvedValue({ id: "app_1", status: "SUBMITTED" }),
    applyStatusChange: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

const params = {
  applicationId: "app_1",
  recruiterId: "r_1",
  toStatus: "SCREENING" as const,
  note: "",
};

describe("runChangeStatus", () => {
  it("đổi trạng thái hợp lệ và ghi event", async () => {
    const d = deps();
    const r = await runChangeStatus(params, d);
    expect(r).toEqual({ ok: true });
    expect(d.applyStatusChange).toHaveBeenCalledWith({
      applicationId: "app_1",
      fromStatus: "SUBMITTED",
      toStatus: "SCREENING",
      note: "",
    });
  });

  it("từ chối khi không phải chủ tin (không tìm thấy đơn)", async () => {
    const r = await runChangeStatus(
      params,
      deps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) }),
    );
    expect(r).toEqual({ ok: false, error: "Không tìm thấy đơn ứng tuyển" });
  });

  it("từ chối chuyển trạng thái không hợp lệ", async () => {
    const d = deps({
      findApplicationForRecruiter: vi
        .fn()
        .mockResolvedValue({ id: "app_1", status: "SCREENING" }),
    });
    const r = await runChangeStatus(
      { ...params, toStatus: "SUBMITTED" },
      d,
    );
    expect(r).toEqual({ ok: false, error: "Không thể chuyển sang trạng thái này" });
    expect(d.applyStatusChange).not.toHaveBeenCalled();
  });
});
