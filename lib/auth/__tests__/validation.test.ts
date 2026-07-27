import { describe, it, expect } from "vitest";
import { registerSchema } from "../validation";

describe("registerSchema", () => {
  it("chap nhan input hop le", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "Manh", password: "matkhau123",
    });
    expect(r.success).toBe(true);
  });

  it("tu choi email sai dinh dang", () => {
    const r = registerSchema.safeParse({
      email: "khong-phai-email", name: "Manh", password: "matkhau123",
    });
    expect(r.success).toBe(false);
  });

  it("tu choi mat khau ngan hon 8 ky tu", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "Manh", password: "1234",
    });
    expect(r.success).toBe(false);
  });

  it("tu choi ten rong", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "", password: "matkhau123",
    });
    expect(r.success).toBe(false);
  });
});
