import { describe, it, expect } from "vitest";
import { computeFunnel } from "../recruiter-funnel";

// helper: dựng events cho 1 app theo chuỗi toStatus
function ev(appId: string, ...statuses: string[]) {
  return statuses.map((toStatus) => ({ applicationId: appId, toStatus }));
}

describe("computeFunnel", () => {
  it("đếm reached theo bước cao nhất mỗi đơn", () => {
    const apps = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const events = [
      ...ev("a", "SUBMITTED", "SCREENING", "INTERVIEW"),
      ...ev("b", "SUBMITTED", "SCREENING"),
      ...ev("c", "SUBMITTED"),
    ];
    const r = computeFunnel(apps, events);
    expect(r.total).toBe(3);
    const counts = r.rows.map((x) => x.count);
    expect(counts).toEqual([3, 2, 1, 0, 0]); // SUBMITTED, SCREENING, INTERVIEW, OFFER, HIRED
  });

  it("nhảy bước: chạm OFFER tính luôn các bước giữa", () => {
    const apps = [{ id: "a" }];
    const events = ev("a", "SUBMITTED", "OFFER");
    const r = computeFunnel(apps, events);
    expect(r.rows.map((x) => x.count)).toEqual([1, 1, 1, 1, 0]);
  });

  it("tỷ lệ chuyển đổi từ bước trước; bước đầu null", () => {
    const apps = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const events = [
      ...ev("a", "SUBMITTED", "SCREENING"),
      ...ev("b", "SUBMITTED", "SCREENING"),
      ...ev("c", "SUBMITTED"),
      ...ev("d", "SUBMITTED"),
    ];
    const r = computeFunnel(apps, events);
    expect(r.rows[0].conversionFromPrev).toBeNull();
    expect(r.rows[1].conversionFromPrev).toBe(0.5); // 2/4 reached SCREENING
    expect(r.rows[0].pctOfTotal).toBe(1);
  });

  it("đơn REJECTED giữ trong funnel tới bước đã chạm", () => {
    const apps = [{ id: "a" }];
    const events = ev("a", "SUBMITTED", "SCREENING", "REJECTED");
    const r = computeFunnel(apps, events);
    expect(r.rows.map((x) => x.count)).toEqual([1, 1, 0, 0, 0]); // REJECTED không phải bước funnel
  });

  it("rỗng: total 0, count 0, không lỗi chia 0", () => {
    const r = computeFunnel([], []);
    expect(r.total).toBe(0);
    expect(r.rows.every((x) => x.count === 0 && x.pctOfTotal === 0)).toBe(true);
    expect(r.rows[0].conversionFromPrev).toBeNull();
    expect(r.rows[1].conversionFromPrev).toBe(0); // reached[0]=0 -> 0, không NaN
  });
});
