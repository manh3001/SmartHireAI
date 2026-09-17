import { describe, it, expect } from "vitest";
import { isEmailVerified } from "../require-verified";

describe("isEmailVerified", () => {
  it("null user -> false", () => {
    expect(isEmailVerified(null)).toBe(false);
  });
  it("emailVerified null -> false", () => {
    expect(isEmailVerified({ emailVerified: null })).toBe(false);
  });
  it("co emailVerified -> true", () => {
    expect(isEmailVerified({ emailVerified: new Date() })).toBe(true);
  });
});
