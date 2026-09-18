import { describe, it, expect } from "vitest";
import { mapDraftToForm } from "../jd-draft-map";

describe("mapDraftToForm", () => {
  it("map cơ bản: skills join, rawText = description", () => {
    const r = mapDraftToForm({
      description: "Nội dung JD",
      skills: ["React", "Node"],
      employmentType: "FULL_TIME",
      experienceLevel: "JUNIOR",
      categorySlug: "it",
    });
    expect(r.rawText).toBe("Nội dung JD");
    expect(r.skills).toBe("React, Node");
    expect(r.category).toBe("it");
    expect(r.employmentType).toBe("FULL_TIME");
    expect(r.experienceLevel).toBe("JUNIOR");
  });
  it("categorySlug không hợp lệ -> null", () => {
    const r = mapDraftToForm({
      description: "x", skills: [], employmentType: null,
      experienceLevel: null, categorySlug: "khong-ton-tai",
    });
    expect(r.category).toBeNull();
    expect(r.skills).toBe("");
  });
});
