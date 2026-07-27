import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password", () => {
  it("bam roi xac minh dung mat khau", async () => {
    const hash = await hashPassword("matkhau123");
    expect(hash).not.toBe("matkhau123");
    expect(await verifyPassword("matkhau123", hash)).toBe(true);
  });

  it("tu choi mat khau sai", async () => {
    const hash = await hashPassword("matkhau123");
    expect(await verifyPassword("saibet", hash)).toBe(false);
  });
});
