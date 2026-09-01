import { describe, it, expect } from "vitest";
import { computeAvgTimeToHire, computeTopJobs } from "../recruiter-analytics";

const DAY = 1000 * 60 * 60 * 24;
const now = new Date("2026-09-01T12:00:00Z");

describe("computeAvgTimeToHire", () => {
  it("no apps → null", () => {
    expect(computeAvgTimeToHire([], [])).toBeNull();
  });

  it("apps but none HIRED → null", () => {
    const apps = [{ id: "a1", createdAt: new Date(now.getTime() - 5 * DAY), status: "SUBMITTED" as const }];
    expect(computeAvgTimeToHire(apps, [])).toBeNull();
  });

  it("1 HIRED app — returns days between createdAt and HIRED event", () => {
    const createdAt = new Date(now.getTime() - 10 * DAY);
    const hiredAt = new Date(now.getTime() - 5 * DAY);
    const apps = [{ id: "a1", createdAt, status: "HIRED" as const }];
    const events = [{ applicationId: "a1", toStatus: "HIRED", createdAt: hiredAt }];
    const result = computeAvgTimeToHire(apps, events);
    expect(result).toBe(5);
  });

  it("2 HIRED apps — returns average", () => {
    const base = now.getTime();
    const apps = [
      { id: "a1", createdAt: new Date(base - 10 * DAY), status: "HIRED" as const },
      { id: "a2", createdAt: new Date(base - 6 * DAY), status: "HIRED" as const },
    ];
    const events = [
      { applicationId: "a1", toStatus: "HIRED", createdAt: new Date(base - 4 * DAY) },
      { applicationId: "a2", toStatus: "HIRED", createdAt: new Date(base - 2 * DAY) },
    ];
    // a1: 10-4=6 days, a2: 6-2=4 days → avg 5
    const result = computeAvgTimeToHire(apps, events);
    expect(result).toBe(5);
  });

  it("HIRED app but no HIRED event → skip that app", () => {
    const apps = [{ id: "a1", createdAt: now, status: "HIRED" as const }];
    expect(computeAvgTimeToHire(apps, [])).toBeNull();
  });
});

describe("computeTopJobs", () => {
  const makeApp = (id: string, jobId: string, status: "SUBMITTED" | "HIRED" | "REJECTED", score: number | null = null) => ({
    id,
    jobId,
    status: status as any,
    job: { id: jobId, title: `Job ${jobId}` },
    evaluation: score !== null ? { overallScore: score } : null,
  });

  it("returns top 5 sorted by total DESC", () => {
    const apps = [
      makeApp("a1", "j1", "SUBMITTED"),
      makeApp("a2", "j1", "SUBMITTED"),
      makeApp("a3", "j2", "SUBMITTED"),
    ];
    const result = computeTopJobs(apps);
    expect(result[0].jobId).toBe("j1");
    expect(result[0].total).toBe(2);
    expect(result[1].jobId).toBe("j2");
    expect(result[1].total).toBe(1);
  });

  it("avgScore is null when no evaluations", () => {
    const apps = [makeApp("a1", "j1", "SUBMITTED", null)];
    const result = computeTopJobs(apps);
    expect(result[0].avgScore).toBeNull();
  });

  it("avgScore computed correctly", () => {
    const apps = [
      makeApp("a1", "j1", "SUBMITTED", 80),
      makeApp("a2", "j1", "SUBMITTED", 60),
    ];
    const result = computeTopJobs(apps);
    expect(result[0].avgScore).toBe(70);
  });

  it("progressRate excludes REJECTED and WITHDRAWN", () => {
    const apps = [
      makeApp("a1", "j1", "SUBMITTED"),
      makeApp("a2", "j1", "SUBMITTED"),
      { ...makeApp("a3", "j1", "REJECTED"), status: "REJECTED" as any },
    ];
    const result = computeTopJobs(apps);
    // 2 of 3 not rejected → 2/3
    expect(result[0].progressRate).toBeCloseTo(2 / 3);
  });

  it("caps at 5 jobs", () => {
    const apps = Array.from({ length: 6 }, (_, i) =>
      makeApp(`a${i}`, `j${i}`, "SUBMITTED")
    );
    const result = computeTopJobs(apps);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
