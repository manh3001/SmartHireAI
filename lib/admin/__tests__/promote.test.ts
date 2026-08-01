import { describe, it, expect, vi } from "vitest";
import { promoteToAdmin, type PromoteDeps } from "../promote";

function deps(over: Partial<PromoteDeps> = {}): PromoteDeps {
  return {
    findByEmail: vi.fn().mockResolvedValue({ id: "u1", role: "CANDIDATE" }),
    setRole: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("promoteToAdmin", () => {
  it("email rỗng -> lỗi", async () => {
    const r = await promoteToAdmin("   ", deps());
    expect(r.ok).toBe(false);
  });
  it("không tìm thấy user -> lỗi", async () => {
    const r = await promoteToAdmin("x@y.com", deps({ findByEmail: vi.fn().mockResolvedValue(null) }));
    expect(r).toEqual({ ok: false, error: "Không tìm thấy user với email x@y.com" });
  });
  it("user thường -> setRole ADMIN, alreadyAdmin=false", async () => {
    const d = deps();
    const r = await promoteToAdmin(" a@b.com ", d);
    expect(r).toEqual({ ok: true, alreadyAdmin: false });
    expect(d.setRole).toHaveBeenCalledWith("u1");
  });
  it("đã là ADMIN -> không gọi setRole, alreadyAdmin=true", async () => {
    const d = deps({ findByEmail: vi.fn().mockResolvedValue({ id: "u1", role: "ADMIN" }) });
    const r = await promoteToAdmin("a@b.com", d);
    expect(r).toEqual({ ok: true, alreadyAdmin: true });
    expect(d.setRole).not.toHaveBeenCalled();
  });
});
