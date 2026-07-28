import { describe, it, expect } from "vitest";
import { createRateLimiter } from "../rate-limit";

describe("createRateLimiter", () => {
  it("cho phep toi da 'max' lan trong cua so", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 60000 });
    expect(rl.check("u1", 1000)).toBe(true);
    expect(rl.check("u1", 1100)).toBe(true);
    expect(rl.check("u1", 1200)).toBe(false); // lan 3 -> chan
  });

  it("reset sau khi qua cua so thoi gian", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.check("u1", 0)).toBe(true);
    expect(rl.check("u1", 500)).toBe(false);
    expect(rl.check("u1", 1500)).toBe(true); // da qua 1000ms
  });

  it("tach biet theo key", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60000 });
    expect(rl.check("u1", 0)).toBe(true);
    expect(rl.check("u2", 0)).toBe(true);
    expect(rl.check("u1", 0)).toBe(false);
  });
});
