import { describe, it, expect } from "vitest";
import { passwordStrength } from "../password-strength";

describe("passwordStrength", () => {
  it("ok khi >=8 ky tu, co chu va so", () => {
    expect(passwordStrength("abcd1234")).toEqual({ ok: true });
  });
  it("tu choi khi < 8 ky tu", () => {
    expect(passwordStrength("ab12")).toEqual({ ok: false, error: "Mật khẩu tối thiểu 8 ký tự" });
  });
  it("tu choi khi thieu chu so", () => {
    expect(passwordStrength("abcdefgh")).toEqual({ ok: false, error: "Mật khẩu cần ít nhất một chữ số" });
  });
  it("tu choi khi thieu chu cai", () => {
    expect(passwordStrength("12345678")).toEqual({ ok: false, error: "Mật khẩu cần ít nhất một chữ cái" });
  });
  it("tu choi khi > 72 ky tu (gioi han bcrypt)", () => {
    expect(passwordStrength("a1" + "x".repeat(71))).toEqual({ ok: false, error: "Mật khẩu tối đa 72 ký tự" });
  });
});
