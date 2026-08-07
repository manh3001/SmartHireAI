import { describe, it, expect } from "vitest";
import { buildJobsWhere } from "../job-query";

describe("buildJobsWhere", () => {
  it("no filters -> only isPublic: true, no AND", () => {
    const result = buildJobsWhere({});
    expect(result).toEqual({ isPublic: true });
    expect(result).not.toHaveProperty("AND");
  });

  it("term only -> AND contains exactly the search OR fragment (5 fields)", () => {
    const result = buildJobsWhere({ term: "react" });
    expect(result.isPublic).toBe(true);
    expect(result).not.toHaveProperty("OR");
    const and = result.AND as Record<string, unknown>[];
    expect(Array.isArray(and)).toBe(true);
    expect(and).toHaveLength(1);
    expect(and[0]).toEqual({
      OR: [
        { title: { contains: "react", mode: "insensitive" } },
        { company: { contains: "react", mode: "insensitive" } },
        { rawText: { contains: "react", mode: "insensitive" } },
        { location: { contains: "react", mode: "insensitive" } },
        { skills: { contains: "react", mode: "insensitive" } },
      ],
    });
  });

  it("salary only (15) -> AND contains exactly the salary OR fragment", () => {
    const result = buildJobsWhere({ salaryMillions: 15 });
    expect(result.isPublic).toBe(true);
    expect(result).not.toHaveProperty("OR");
    const and = result.AND as Record<string, unknown>[];
    expect(Array.isArray(and)).toBe(true);
    expect(and).toHaveLength(1);
    expect(and[0]).toEqual({
      OR: [
        { salaryMax: { gte: 15_000_000 } },
        { AND: [{ salaryMax: null }, { salaryMin: { gte: 15_000_000 } }] },
      ],
    });
  });

  it("salary(15) + term('react') -> AND has TWO entries: salary fragment AND search fragment (regression)", () => {
    const result = buildJobsWhere({ salaryMillions: 15, term: "react" });
    expect(result.isPublic).toBe(true);
    expect(result).not.toHaveProperty("OR");
    const and = result.AND as Record<string, unknown>[];
    expect(Array.isArray(and)).toBe(true);
    expect(and).toHaveLength(2);
    // First entry: salary fragment
    expect(and[0]).toEqual({
      OR: [
        { salaryMax: { gte: 15_000_000 } },
        { AND: [{ salaryMax: null }, { salaryMin: { gte: 15_000_000 } }] },
      ],
    });
    // Second entry: search fragment
    expect(and[1]).toEqual({
      OR: [
        { title: { contains: "react", mode: "insensitive" } },
        { company: { contains: "react", mode: "insensitive" } },
        { rawText: { contains: "react", mode: "insensitive" } },
        { location: { contains: "react", mode: "insensitive" } },
        { skills: { contains: "react", mode: "insensitive" } },
      ],
    });
  });

  it("employmentType passed -> appears as top-level key", () => {
    const result = buildJobsWhere({ employmentType: "FULL_TIME" });
    expect(result.employmentType).toBe("FULL_TIME");
    expect(result.isPublic).toBe(true);
  });

  it("experienceLevel passed -> appears as top-level key", () => {
    const result = buildJobsWhere({ experienceLevel: "SENIOR" });
    expect(result.experienceLevel).toBe("SENIOR");
    expect(result.isPublic).toBe(true);
  });

  it("category passed -> appears as top-level key", () => {
    const result = buildJobsWhere({ category: "it" });
    expect(result.category).toBe("it");
    expect(result.isPublic).toBe(true);
  });

  it("no category -> no category key", () => {
    const result = buildJobsWhere({ term: "react" });
    expect(result).not.toHaveProperty("category");
  });
});
