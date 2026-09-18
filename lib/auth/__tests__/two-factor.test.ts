import { describe, it, expect, vi } from "vitest";
import { resolveTwoFactor } from "../two-factor";

const noBackup = { checkTotp: () => false, consumeBackup: async () => false };

describe("resolveTwoFactor", () => {
  it("chưa bật 2FA -> ok (bỏ qua mã)", async () => {
    expect(await resolveTwoFactor({ totpEnabled: false, code: undefined }, noBackup)).toBe("ok");
  });
  it("bật 2FA nhưng thiếu mã -> required", async () => {
    expect(await resolveTwoFactor({ totpEnabled: true, code: undefined }, noBackup)).toBe("required");
    expect(await resolveTwoFactor({ totpEnabled: true, code: "" }, noBackup)).toBe("required");
  });
  it("TOTP hợp lệ -> ok, không đụng backup", async () => {
    const consumeBackup = vi.fn();
    const r = await resolveTwoFactor(
      { totpEnabled: true, code: "123456" },
      { checkTotp: () => true, consumeBackup },
    );
    expect(r).toBe("ok");
    expect(consumeBackup).not.toHaveBeenCalled();
  });
  it("TOTP sai nhưng backup hợp lệ -> ok", async () => {
    const r = await resolveTwoFactor(
      { totpEnabled: true, code: "ABCDE-FGHJK" },
      { checkTotp: () => false, consumeBackup: async () => true },
    );
    expect(r).toBe("ok");
  });
  it("TOTP sai + backup sai -> invalid", async () => {
    const r = await resolveTwoFactor(
      { totpEnabled: true, code: "999999" },
      { checkTotp: () => false, consumeBackup: async () => false },
    );
    expect(r).toBe("invalid");
  });
});
