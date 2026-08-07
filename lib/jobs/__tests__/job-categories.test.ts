import { describe, it, expect } from "vitest";
import {
  JOB_CATEGORIES,
  JOB_CATEGORY_LABELS,
  isJobCategory,
  normalizeCategory,
} from "../job-categories";

describe("job-categories", () => {
  it("có ít nhất 6 ngành, slug duy nhất", () => {
    const slugs = JOB_CATEGORIES.map((c) => c.slug);
    expect(slugs.length).toBeGreaterThanOrEqual(6);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("mỗi ngành có label khớp JOB_CATEGORY_LABELS", () => {
    for (const c of JOB_CATEGORIES) {
      expect(JOB_CATEGORY_LABELS[c.slug]).toBe(c.label);
    }
  });

  it("isJobCategory nhận slug hợp lệ, từ chối giá trị lạ", () => {
    expect(isJobCategory("it")).toBe(true);
    expect(isJobCategory("khong-ton-tai")).toBe(false);
    expect(isJobCategory(null)).toBe(false);
    expect(isJobCategory(123)).toBe(false);
  });

  it("normalizeCategory: hợp lệ -> slug, lạ/empty -> null", () => {
    expect(normalizeCategory("design")).toBe("design");
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory("xxx")).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
  });
});
