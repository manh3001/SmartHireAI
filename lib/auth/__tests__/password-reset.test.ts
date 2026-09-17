import { describe, it, expect, vi } from "vitest";
import { requestReset, confirmReset } from "../password-reset";
import { hashToken } from "../tokens";

describe("requestReset", () => {
  const now = () => new Date("2026-01-01T00:00:00.000Z");

  it("user khong ton tai -> null, khong tao token", async () => {
    const createToken = vi.fn();
    const r = await requestReset("no@x.com", {
      findUser: vi.fn().mockResolvedValue(null),
      createToken,
      now,
    });
    expect(r).toBeNull();
    expect(createToken).not.toHaveBeenCalled();
  });

  it("tai khoan chi-Google (hasPassword=false) -> null", async () => {
    const createToken = vi.fn();
    const r = await requestReset("g@x.com", {
      findUser: vi.fn().mockResolvedValue({ id: "u1", hasPassword: false }),
      createToken,
      now,
    });
    expect(r).toBeNull();
    expect(createToken).not.toHaveBeenCalled();
  });

  it("user co mat khau -> tao token PASSWORD_RESET (han 1h)", async () => {
    const createToken = vi.fn().mockResolvedValue(undefined);
    const r = await requestReset("a@x.com", {
      findUser: vi.fn().mockResolvedValue({ id: "u1", hasPassword: true }),
      createToken,
      now,
    });
    expect(r?.userId).toBe("u1");
    const arg = createToken.mock.calls[0][0];
    expect(arg.purpose).toBe("PASSWORD_RESET");
    expect(arg.tokenHash).toBe(hashToken(r!.raw));
    expect(arg.expiresAt.toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
});

describe("confirmReset", () => {
  const now = () => new Date("2026-01-01T00:30:00.000Z");
  const valid = { userId: "u1", purpose: "PASSWORD_RESET", expiresAt: new Date("2026-01-01T01:00:00.000Z"), usedAt: null };

  it("token khong ton tai -> invalid", async () => {
    const r = await confirmReset("raw", "Str0ng!Pass9", {
      findToken: vi.fn().mockResolvedValue(null),
      hash: vi.fn(), applyReset: vi.fn(), now,
    });
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });

  it("mat khau yeu -> weak, khong dung token", async () => {
    const applyReset = vi.fn();
    const r = await confirmReset("raw", "123", {
      findToken: vi.fn().mockResolvedValue(valid),
      hash: vi.fn(), applyReset, now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("weak");
    expect(applyReset).not.toHaveBeenCalled();
  });

  it("token hop le + mat khau manh -> ok + applyReset", async () => {
    const applyReset = vi.fn().mockResolvedValue(undefined);
    const hash = vi.fn().mockResolvedValue("HASHED");
    const r = await confirmReset("raw", "Str0ng!Pass9", {
      findToken: vi.fn().mockResolvedValue(valid), hash, applyReset, now,
    });
    expect(r).toEqual({ ok: true, userId: "u1" });
    expect(applyReset).toHaveBeenCalledWith("u1", "HASHED", hashToken("raw"), now());
  });

  it("token het han -> expired", async () => {
    const r = await confirmReset("raw", "Str0ng!Pass9", {
      findToken: vi.fn().mockResolvedValue({ ...valid, expiresAt: new Date("2026-01-01T00:00:00.000Z") }),
      hash: vi.fn(), applyReset: vi.fn(), now,
    });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });
});
