import { describe, it, expect } from "vitest";
import { CV_FONTS, isCvFont, normalizeFont, fontById } from "../fonts";

describe("cv fonts", () => {
  it("đúng 3 font, id duy nhất, theo thứ tự", () => {
    const ids = CV_FONTS.map((f) => f.id);
    expect(ids).toEqual(["roboto", "bevietnam", "lora"]);
    expect(new Set(ids).size).toBe(3);
  });
  it("roboto mặc định: pdfFamily Roboto, cssStack rỗng (giữ font app)", () => {
    const r = fontById("roboto");
    expect(r.pdfFamily).toBe("Roboto");
    expect(r.cssStack).toBe("");
  });
  it("lora là serif, bevietnam là sans (pdfFamily khớp Font.register)", () => {
    expect(fontById("lora").pdfFamily).toBe("Lora");
    expect(fontById("bevietnam").pdfFamily).toBe("Be Vietnam Pro");
  });
  it("isCvFont nhận id hợp lệ, từ chối lạ", () => {
    expect(isCvFont("lora")).toBe(true);
    expect(isCvFont("comic")).toBe(false);
    expect(isCvFont(null)).toBe(false);
  });
  it("normalizeFont: hợp lệ giữ nguyên; lạ/null/undefined -> roboto", () => {
    expect(normalizeFont("bevietnam")).toBe("bevietnam");
    expect(normalizeFont("nope")).toBe("roboto");
    expect(normalizeFont(undefined)).toBe("roboto");
    expect(normalizeFont(null)).toBe("roboto");
  });
});
