import { describe, it, expect, vi } from "vitest";
import { recordAudit, AUDIT_ACTIONS } from "../log";

describe("recordAudit", () => {
  it("goi save voi entry", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await recordAudit({ action: AUDIT_ACTIONS.loginSuccess, userId: "u1", ip: "1.2.3.4" }, { save });
    expect(save).toHaveBeenCalledWith({
      action: "login.success",
      userId: "u1",
      ip: "1.2.3.4",
    });
  });

  it("nuot loi khi save that bai (khong nem)", async () => {
    const save = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(
      recordAudit({ action: AUDIT_ACTIONS.register, userId: "u2" }, { save }),
    ).resolves.toBeUndefined();
  });
});
