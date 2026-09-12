import { describe, it, expect } from "vitest";
import { buildApplicationTimeline } from "../timeline";

const d = (s: string) => new Date(s);

describe("buildApplicationTimeline", () => {
  it("chỉ mới nộp -> 1 bước Đã nộp, isCurrent", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "SUBMITTED",
      events: [],
    });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ status: "SUBMITTED", label: "Đã nộp", isCurrent: true });
  });

  it("nộp + sàng lọc + phỏng vấn -> 3 bước, bước cuối current", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "INTERVIEW",
      events: [
        { toStatus: "SCREENING", createdAt: d("2026-09-02T09:00:00Z") },
        { toStatus: "INTERVIEW", createdAt: d("2026-09-03T09:00:00Z") },
      ],
    });
    expect(steps.map((s) => s.status)).toEqual(["SUBMITTED", "SCREENING", "INTERVIEW"]);
    expect(steps[2].isCurrent).toBe(true);
    expect(steps[0].isCurrent).toBe(false);
  });

  it("không nhân đôi khi event đầu đã là SUBMITTED", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "SCREENING",
      events: [
        { toStatus: "SUBMITTED", createdAt: d("2026-09-01T09:00:00Z") },
        { toStatus: "SCREENING", createdAt: d("2026-09-02T09:00:00Z") },
      ],
    });
    expect(steps.map((s) => s.status)).toEqual(["SUBMITTED", "SCREENING"]);
    expect(steps[1].isCurrent).toBe(true);
  });

  it("REJECTED là bước cuối current", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "REJECTED",
      events: [
        { toStatus: "SCREENING", createdAt: d("2026-09-02T09:00:00Z") },
        { toStatus: "REJECTED", createdAt: d("2026-09-03T09:00:00Z") },
      ],
    });
    expect(steps[steps.length - 1]).toMatchObject({ status: "REJECTED", isCurrent: true });
  });
});
