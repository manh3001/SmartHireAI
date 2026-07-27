import { describe, it, expect } from "vitest";

describe("prisma client", () => {
  it("tra ve cung mot instance khi import lai", async () => {
    const a = (await import("../prisma")).default;
    const b = (await import("../prisma")).default;
    expect(a).toBe(b);
  });
});
