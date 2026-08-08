import { describe, it, expect } from "vitest";
import { CV_TEMPLATES, isCvTemplate, normalizeTemplate } from "../templates";

describe("cv templates", () => {
  it("đúng 3 mẫu, id duy nhất, theo thứ tự", () => {
    const ids = CV_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["classic", "modern", "sidebar"]);
    expect(new Set(ids).size).toBe(3);
  });
  it("isCvTemplate nhận id hợp lệ, từ chối giá trị lạ", () => {
    expect(isCvTemplate("classic")).toBe(true);
    expect(isCvTemplate("sidebar")).toBe(true);
    expect(isCvTemplate("xxx")).toBe(false);
    expect(isCvTemplate(null)).toBe(false);
    expect(isCvTemplate(123)).toBe(false);
  });
  it("normalizeTemplate: hợp lệ giữ nguyên; lạ/rỗng/null/undefined -> classic", () => {
    expect(normalizeTemplate("modern")).toBe("modern");
    expect(normalizeTemplate("")).toBe("classic");
    expect(normalizeTemplate("nope")).toBe("classic");
    expect(normalizeTemplate(undefined)).toBe("classic");
    expect(normalizeTemplate(null)).toBe("classic");
  });
});
