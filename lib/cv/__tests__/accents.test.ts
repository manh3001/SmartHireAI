import { describe, it, expect } from "vitest";
import { CV_ACCENTS, isCvAccent, normalizeAccent, accentById } from "../accents";

describe("cv accents", () => {
  it("đúng 6 màu, id duy nhất, theo thứ tự", () => {
    const ids = CV_ACCENTS.map((a) => a.id);
    expect(ids).toEqual(["indigo", "blue", "emerald", "rose", "amber", "slate"]);
    expect(new Set(ids).size).toBe(6);
  });
  it("mỗi màu có hex/soft/onDark dạng #rrggbb", () => {
    for (const a of CV_ACCENTS) {
      for (const c of [a.hex, a.soft, a.onDark]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("indigo trùng hằng số PDF hiện tại (bảo toàn output)", () => {
    const indigo = accentById("indigo");
    expect(indigo.hex).toBe("#4f46e5");
    expect(indigo.soft).toBe("#eef2ff");
    expect(indigo.onDark).toBe("#e0e7ff");
  });
  it("isCvAccent nhận id hợp lệ, từ chối lạ", () => {
    expect(isCvAccent("rose")).toBe(true);
    expect(isCvAccent("xxx")).toBe(false);
    expect(isCvAccent(null)).toBe(false);
    expect(isCvAccent(7)).toBe(false);
  });
  it("normalizeAccent: hợp lệ giữ nguyên; lạ/rỗng/null/undefined -> indigo", () => {
    expect(normalizeAccent("emerald")).toBe("emerald");
    expect(normalizeAccent("")).toBe("indigo");
    expect(normalizeAccent("nope")).toBe("indigo");
    expect(normalizeAccent(undefined)).toBe("indigo");
    expect(normalizeAccent(null)).toBe("indigo");
  });
  it("accentById trả đúng def", () => {
    expect(accentById("rose").label).toBe("Đỏ mận");
  });
});
