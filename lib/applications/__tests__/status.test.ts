import { describe, it, expect } from "vitest";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  canTransition,
  canWithdraw,
} from "../status";

describe("status", () => {
  it("có đủ 6 trạng thái với nhãn tiếng Việt", () => {
    expect(APPLICATION_STATUSES).toHaveLength(6);
    expect(STATUS_LABELS.SUBMITTED).toBe("Đã nộp");
    expect(STATUS_LABELS.HIRED).toBe("Nhận");
  });

  it("không cho chuyển về cùng trạng thái", () => {
    expect(canTransition("SCREENING", "SCREENING")).toBe(false);
  });

  it("không cho chuyển ngược về SUBMITTED", () => {
    expect(canTransition("SCREENING", "SUBMITTED")).toBe(false);
  });

  it("cho chuyển sang trạng thái khác hợp lệ", () => {
    expect(canTransition("SUBMITTED", "SCREENING")).toBe(true);
    expect(canTransition("INTERVIEW", "OFFER")).toBe(true);
    expect(canTransition("SCREENING", "REJECTED")).toBe(true);
  });

  it("chỉ cho rút đơn khi mới nộp hoặc đang sàng lọc", () => {
    expect(canWithdraw("SUBMITTED")).toBe(true);
    expect(canWithdraw("SCREENING")).toBe(true);
    expect(canWithdraw("INTERVIEW")).toBe(false);
    expect(canWithdraw("HIRED")).toBe(false);
  });
});
