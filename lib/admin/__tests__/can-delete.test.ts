import { describe, it, expect } from "vitest";
import { canDeleteUser } from "../can-delete";

describe("canDeleteUser", () => {
  it("chặn tự xoá chính mình", () => {
    expect(canDeleteUser("u1", { id: "u1", role: "CANDIDATE" })).toEqual({
      ok: false, reason: "Không thể tự xoá chính mình",
    });
  });
  it("chặn xoá tài khoản admin khác", () => {
    expect(canDeleteUser("u1", { id: "u2", role: "ADMIN" })).toEqual({
      ok: false, reason: "Không thể xoá tài khoản admin",
    });
  });
  it("cho xoá user thường khác", () => {
    expect(canDeleteUser("u1", { id: "u2", role: "CANDIDATE" })).toEqual({ ok: true });
    expect(canDeleteUser("u1", { id: "u3", role: "RECRUITER" })).toEqual({ ok: true });
  });
});
