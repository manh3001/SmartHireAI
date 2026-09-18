import { describe, it, expect } from "vitest";
import { jdDraftSchema } from "../jd-draft-schema";

describe("jdDraftSchema", () => {
  it("parse object hợp lệ", () => {
    const r = jdDraftSchema.parse({
      description: "Mô tả...",
      skills: ["React", "Node"],
      employmentType: "FULL_TIME",
      experienceLevel: "JUNIOR",
      categorySlug: "it",
    });
    expect(r.skills).toEqual(["React", "Node"]);
    expect(r.employmentType).toBe("FULL_TIME");
  });
  it("chấp nhận enum null", () => {
    const r = jdDraftSchema.parse({
      description: "x",
      skills: [],
      employmentType: null,
      experienceLevel: null,
      categorySlug: null,
    });
    expect(r.employmentType).toBeNull();
    expect(r.categorySlug).toBeNull();
  });
  it("từ chối employmentType không hợp lệ", () => {
    expect(() =>
      jdDraftSchema.parse({
        description: "x", skills: [], employmentType: "WEEKEND",
        experienceLevel: null, categorySlug: null,
      }),
    ).toThrow();
  });
});
