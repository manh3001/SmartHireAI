import { describe, it, expect } from "vitest";
import { validateLogo, isLogoMime, LOGO_MAX_BYTES } from "../logo";

describe("isLogoMime", () => {
  it("nhận PNG/JPEG/WebP", () => {
    expect(isLogoMime("image/png")).toBe(true);
    expect(isLogoMime("image/jpeg")).toBe(true);
    expect(isLogoMime("image/webp")).toBe(true);
  });
  it("từ chối mime khác", () => {
    expect(isLogoMime("image/gif")).toBe(false);
    expect(isLogoMime("application/pdf")).toBe(false);
    expect(isLogoMime("")).toBe(false);
  });
});

describe("validateLogo", () => {
  it("chấp nhận ảnh hợp lệ", () => {
    expect(validateLogo({ type: "image/png", size: 1000 })).toEqual({ ok: true });
  });
  it("từ chối mime lạ với thông báo", () => {
    expect(validateLogo({ type: "image/gif", size: 1000 })).toEqual({ ok: false, error: "Chỉ hỗ trợ PNG, JPEG, WebP" });
    expect(validateLogo({ type: "application/pdf", size: 1000 })).toEqual({ ok: false, error: "Chỉ hỗ trợ PNG, JPEG, WebP" });
  });
  it("từ chối file quá lớn", () => {
    expect(validateLogo({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toEqual({ ok: false, error: "Ảnh quá lớn (tối đa 500KB)" });
  });
  it("chấp nhận đúng ngưỡng biên", () => {
    expect(validateLogo({ type: "image/png", size: LOGO_MAX_BYTES })).toEqual({ ok: true });
  });
});
