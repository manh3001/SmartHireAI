import { describe, it, expect, vi } from "vitest";
import { createVerification, confirmVerification } from "../email-verification";
import { hashToken } from "../tokens";

describe("createVerification", () => {
  it("tao token EMAIL_VERIFY va tra raw", async () => {
    const createToken = vi.fn().mockResolvedValue(undefined);
    const now = () => new Date("2026-01-01T00:00:00.000Z");
    const { raw } = await createVerification("u1", { createToken, now });
    expect(raw.length).toBeGreaterThan(20);
    const arg = createToken.mock.calls[0][0];
    expect(arg.userId).toBe("u1");
    expect(arg.purpose).toBe("EMAIL_VERIFY");
    expect(arg.tokenHash).toBe(hashToken(raw));
    expect(arg.expiresAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("confirmVerification", () => {
  const now = () => new Date("2026-01-01T12:00:00.000Z");

  it("token khong ton tai -> invalid", async () => {
    const findToken = vi.fn().mockResolvedValue(null);
    const markVerified = vi.fn();
    const r = await confirmVerification("raw", { findToken, markVerified, now });
    expect(r).toEqual({ ok: false, reason: "invalid" });
    expect(markVerified).not.toHaveBeenCalled();
  });

  it("token het han -> expired", async () => {
    const findToken = vi.fn().mockResolvedValue({
      userId: "u1", purpose: "EMAIL_VERIFY",
      expiresAt: new Date("2026-01-01T00:00:00.000Z"), usedAt: null,
    });
    const r = await confirmVerification("raw", { findToken, markVerified: vi.fn(), now });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("token da dung -> used", async () => {
    const findToken = vi.fn().mockResolvedValue({
      userId: "u1", purpose: "EMAIL_VERIFY",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"), usedAt: new Date("2026-01-01T01:00:00.000Z"),
    });
    const r = await confirmVerification("raw", { findToken, markVerified: vi.fn(), now });
    expect(r).toEqual({ ok: false, reason: "used" });
  });

  it("token hop le -> ok + markVerified", async () => {
    const findToken = vi.fn().mockResolvedValue({
      userId: "u1", purpose: "EMAIL_VERIFY",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"), usedAt: null,
    });
    const markVerified = vi.fn().mockResolvedValue(undefined);
    const r = await confirmVerification("raw", { findToken, markVerified, now });
    expect(r).toEqual({ ok: true, userId: "u1" });
    expect(findToken).toHaveBeenCalledWith(hashToken("raw"));
    expect(markVerified).toHaveBeenCalledWith(hashToken("raw"), "u1", now());
  });
});
