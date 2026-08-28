import { describe, it, expect } from "vitest";
import { makePush, appendFilters } from "../job-sql";

describe("appendFilters", () => {
  it("luon co isPublic; khong term/filter -> chi 1 clause", () => {
    const params: unknown[] = [];
    const { clauses, nqRef } = appendFilters({}, makePush(params));
    expect(clauses).toEqual([`"isPublic" = true`]);
    expect(nqRef).toBeNull();
    expect(params).toEqual([]);
  });

  it("term -> them clause search voi param, va nqRef", () => {
    const params: unknown[] = [];
    const { clauses, nqRef } = appendFilters({ term: "react" }, makePush(params));
    expect(params).toEqual(["react"]);
    expect(nqRef).toBe("immutable_unaccent(lower($1))");
    expect(clauses.some((c) => c.includes("ILIKE") && c.includes("<%"))).toBe(true);
  });

  it("moi filter qua param, enum co cast", () => {
    const params: unknown[] = [];
    const { clauses } = appendFilters(
      { employmentType: "FULL_TIME", experienceLevel: "SENIOR", category: "it", salaryMillions: 15 },
      makePush(params),
    );
    expect(clauses).toContain(`"employmentType" = $1::"EmploymentType"`);
    expect(clauses).toContain(`"experienceLevel" = $2::"ExperienceLevel"`);
    expect(clauses).toContain(`category = $3`);
    expect(params).toEqual(["FULL_TIME", "SENIOR", "it", 15 * 1_000_000]);
  });

  it("exclude bo qua dung chieu do", () => {
    const params: unknown[] = [];
    const { clauses } = appendFilters(
      { employmentType: "FULL_TIME", category: "it" },
      makePush(params),
      "employmentType",
    );
    expect(clauses.some((c) => c.includes(`"employmentType"`))).toBe(false);
    expect(clauses).toContain(`category = $1`);
  });
});
