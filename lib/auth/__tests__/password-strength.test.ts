import { describe, it, expect } from "vitest";
import { passwordStrength } from "../password-strength";

describe("passwordStrength", () => {
  it("ok khi >=8 ky tu, co chu va so", () => {
    expect(passwordStrength("abcd1234")).toEqual({ ok: true });
  });
  it("tu choi khi < 8 ky tu", () => {
    expect(passwordStrength("ab12").ok).toBe(false);
  });
  it("tu choi khi thieu chu so", () => {
    expect(passwordStrength("abcdefgh").ok).toBe(false);
  });
  it("tu choi khi thieu chu cai", () => {
    expect(passwordStrength("12345678").ok).toBe(false);
  });
  it("tu choi khi > 72 ky tu (gioi han bcrypt)", () => {
    expect(passwordStrength("a1" + "x".repeat(71)).ok).toBe(false);
  });
});
