import { describe, it, expect, vi } from "vitest";
import { resolveCredentials } from "../credentials";

const baseUser = {
  id: "u1",
  email: "a@b.com",
  name: "Manh",
  role: "CANDIDATE" as const,
  passwordHash: "hashed",
};

const deps = (over: Partial<ReturnType<typeof mk>> = {}) => ({ ...mk(), ...over });
function mk() {
  return {
    findByEmail: vi.fn().mockResolvedValue(baseUser),
    verify: vi.fn().mockResolvedValue(true),
  };
}

describe("resolveCredentials", () => {
  it("tra ve user khi mat khau dung", async () => {
    const d = deps();
    const r = await resolveCredentials("a@b.com", "matkhau123", d);
    expect(r).toEqual({ id: "u1", email: "a@b.com", name: "Manh", role: "CANDIDATE" });
  });

  it("null khi khong tim thay user", async () => {
    const d = deps({ findByEmail: vi.fn().mockResolvedValue(null) });
    const r = await resolveCredentials("x@y.com", "matkhau123", d);
    expect(r).toBeNull();
    expect(d.verify).not.toHaveBeenCalled();
  });

  it("null khi tai khoan chi-Google (passwordHash null)", async () => {
    const d = deps({
      findByEmail: vi.fn().mockResolvedValue({ ...baseUser, passwordHash: null }),
    });
    const r = await resolveCredentials("a@b.com", "matkhau123", d);
    expect(r).toBeNull();
    expect(d.verify).not.toHaveBeenCalled();
  });

  it("null khi mat khau sai", async () => {
    const d = deps({ verify: vi.fn().mockResolvedValue(false) });
    const r = await resolveCredentials("a@b.com", "sai", d);
    expect(r).toBeNull();
  });
});
