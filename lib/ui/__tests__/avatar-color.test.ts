import { describe, it, expect } from "vitest";
import { avatarStyle, initials } from "../avatar-color";

describe("avatar-color", () => {
  it("cùng tên -> cùng màu (ổn định)", () => {
    expect(avatarStyle("FPT Software")).toEqual(avatarStyle("FPT Software"));
  });

  it("trả về cặp hex hợp lệ", () => {
    const s = avatarStyle("ACME");
    expect(s.from).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(s.to).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("tên khác nhau có thể ra màu khác (không phải luôn cùng 1 màu)", () => {
    const colors = new Set(
      ["A", "B", "C", "D", "E", "F", "G", "H"].map((n) => avatarStyle(n).from),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("initials: 2 từ -> 2 ký tự hoa", () => {
    expect(initials("FPT Software")).toBe("FS");
  });

  it("initials: 1 từ -> tối đa 2 ký tự đầu hoa", () => {
    expect(initials("acme")).toBe("AC");
  });

  it("initials: rỗng -> '?'", () => {
    expect(initials("   ")).toBe("?");
  });
});
