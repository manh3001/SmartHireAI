import { describe, it, expect } from "vitest";
import { computeConversion, formatActivity } from "../shape";

describe("computeConversion", () => {
  it("tính hiredRate và interviewRate", () => {
    const r = computeConversion([
      { status: "SUBMITTED", count: 4 },
      { status: "INTERVIEW", count: 2 },
      { status: "OFFER", count: 1 },
      { status: "HIRED", count: 3 },
    ]);
    expect(r.total).toBe(10);
    expect(r.hiredRate).toBeCloseTo(0.3);
    expect(r.interviewRate).toBeCloseTo(0.6); // (2+1+3)/10
  });
  it("total = 0 -> tỉ lệ 0, không chia 0", () => {
    expect(computeConversion([])).toEqual({ total: 0, hiredRate: 0, interviewRate: 0 });
  });
  it("chỉ INTERVIEW -> interviewRate>0, hiredRate=0", () => {
    const r = computeConversion([{ status: "INTERVIEW", count: 5 }]);
    expect(r.hiredRate).toBe(0);
    expect(r.interviewRate).toBe(1);
  });
});

describe("formatActivity", () => {
  it("dựng chuỗi với nhãn tiếng Việt", () => {
    expect(formatActivity({ toStatus: "INTERVIEW", jobTitle: "Frontend" })).toBe(
      'Đơn "Frontend" chuyển sang Phỏng vấn',
    );
    expect(formatActivity({ toStatus: "HIRED", jobTitle: "Backend" })).toBe(
      'Đơn "Backend" chuyển sang Nhận',
    );
  });
});
