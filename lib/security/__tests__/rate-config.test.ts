import { describe, it, expect } from "vitest";
import { RATE_LIMITS } from "../rate-config";

describe("RATE_LIMITS fail-closed", () => {
  it("scope auth danh dau failClosed", () => {
    expect(RATE_LIMITS.login.failClosed).toBe(true);
    expect(RATE_LIMITS.register.failClosed).toBe(true);
    expect(RATE_LIMITS.passwordReset.failClosed).toBe(true);
  });

  it("scope ai/mutation KHONG fail-closed", () => {
    expect(RATE_LIMITS.ai.failClosed).toBeFalsy();
    expect(RATE_LIMITS.mutation.failClosed).toBeFalsy();
  });

  it("passwordReset co cau hinh gioi han", () => {
    expect(RATE_LIMITS.passwordReset.max).toBeGreaterThan(0);
    expect(RATE_LIMITS.passwordReset.windowMs).toBeGreaterThan(0);
  });
});
