import { describe, it, expect } from "vitest";
import {
  APPLICATION_STATUSES,
  BOARD_STATUSES,
  STATUS_LABELS,
  canTransition,
  canWithdraw,
} from "../status";

describe("status", () => {
  it("APPLICATION_STATUSES gồm 7 trạng thái (có WITHDRAWN)", () => {
    expect(APPLICATION_STATUSES).toHaveLength(7);
    expect(APPLICATION_STATUSES).toContain("WITHDRAWN");
  });

  it("BOARD_STATUSES gồm 6 cột pipeline, không có WITHDRAWN", () => {
    expect(BOARD_STATUSES).toHaveLength(6);
    expect(BOARD_STATUSES).not.toContain("WITHDRAWN");
  });

  it("nhãn tiếng Việt đầy đủ", () => {
    expect(STATUS_LABELS.SUBMITTED).toBe("Đã nộp");
    expect(STATUS_LABELS.HIRED).toBe("Nhận");
    expect(STATUS_LABELS.WITHDRAWN).toBe("Đã rút");
  });

  it("không cho chuyển về cùng trạng thái", () => {
    expect(canTransition("SCREENING", "SCREENING")).toBe(false);
  });

  it("không cho chuyển ngược về SUBMITTED", () => {
    expect(canTransition("SCREENING", "SUBMITTED")).toBe(false);
  });

  it("không cho NTD kéo vào WITHDRAWN", () => {
    expect(canTransition("SCREENING", "WITHDRAWN")).toBe(false);
  });

  it("không cho chuyển ra khỏi WITHDRAWN", () => {
    expect(canTransition("WITHDRAWN", "SCREENING")).toBe(false);
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
