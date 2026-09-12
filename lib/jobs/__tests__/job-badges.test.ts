import { describe, it, expect } from "vitest";
import { jobBadges, HIGH_SALARY_VND } from "../job-badges";

const NOW = new Date("2026-09-12T00:00:00Z");

describe("jobBadges", () => {
  it("khong co createdAt va luong thap -> khong badge", () => {
    expect(jobBadges({ salaryMax: 10_000_000 }, NOW)).toEqual([]);
  });

  it("createdAt trong 7 ngay -> co badge Moi", () => {
    const b = jobBadges({ createdAt: new Date("2026-09-08T00:00:00Z") }, NOW);
    expect(b).toEqual([{ label: "Mới", tone: "new" }]);
  });

  it("createdAt dung 7 ngay van la Moi (bien)", () => {
    const b = jobBadges({ createdAt: new Date("2026-09-05T00:00:00Z") }, NOW);
    expect(b.some((x) => x.tone === "new")).toBe(true);
  });

  it("createdAt qua 7 ngay -> khong Moi", () => {
    const b = jobBadges({ createdAt: new Date("2026-09-04T00:00:00Z") }, NOW);
    expect(b.some((x) => x.tone === "new")).toBe(false);
  });

  it("salaryMax >= nguong -> badge Luong cao", () => {
    const b = jobBadges({ salaryMax: HIGH_SALARY_VND }, NOW);
    expect(b).toEqual([{ label: "Lương cao", tone: "salary" }]);
  });

  it("salaryMax duoi nguong -> khong Luong cao", () => {
    const b = jobBadges({ salaryMax: HIGH_SALARY_VND - 1 }, NOW);
    expect(b.some((x) => x.tone === "salary")).toBe(false);
  });

  it("ca hai dieu kien -> Moi truoc, Luong cao sau", () => {
    const b = jobBadges(
      { createdAt: new Date("2026-09-10T00:00:00Z"), salaryMax: 50_000_000 },
      NOW,
    );
    expect(b).toEqual([
      { label: "Mới", tone: "new" },
      { label: "Lương cao", tone: "salary" },
    ]);
  });
});
