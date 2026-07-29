import { describe, it, expect, vi } from "vitest";
import { registerUser } from "../register";

const deps = () => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "u1" }),
  hash: vi.fn().mockResolvedValue("hashed"),
});

describe("registerUser", () => {
  it("tao user moi khi email chua ton tai", async () => {
    const d = deps();
    const r = await registerUser(
      { email: "a@b.com", name: "Manh", password: "matkhau123" }, d,
    );
    expect(r).toEqual({ ok: true, userId: "u1" });
    expect(d.create).toHaveBeenCalledWith({
      email: "a@b.com", name: "Manh", passwordHash: "hashed", role: "CANDIDATE",
    });
  });

  it("tu choi khi email da ton tai", async () => {
    const d = deps();
    d.findByEmail.mockResolvedValue({ id: "u0" });
    const r = await registerUser(
      { email: "a@b.com", name: "Manh", password: "matkhau123" }, d,
    );
    expect(r).toEqual({ ok: false, error: "Email đã được đăng ký" });
    expect(d.create).not.toHaveBeenCalled();
  });

  it("tu choi input khong hop le", async () => {
    const d = deps();
    const r = await registerUser(
      { email: "sai", name: "", password: "1" }, d,
    );
    expect(r.ok).toBe(false);
  });
});
