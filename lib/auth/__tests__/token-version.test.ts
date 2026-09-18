import { describe, it, expect } from "vitest";
import { checkTokenVersion } from "../token-version";

describe("checkTokenVersion", () => {
  it("dbVersion null (user bị xóa) -> deleted", () => {
    expect(checkTokenVersion({ tokenVersion: 0, dbVersion: null })).toBe("deleted");
    expect(checkTokenVersion({ tokenVersion: undefined, dbVersion: null })).toBe("deleted");
  });
  it("tokenVersion lệch dbVersion -> revoked", () => {
    expect(checkTokenVersion({ tokenVersion: 0, dbVersion: 1 })).toBe("revoked");
    expect(checkTokenVersion({ tokenVersion: 3, dbVersion: 5 })).toBe("revoked");
  });
  it("tokenVersion chưa set (đăng nhập lần đầu) -> valid", () => {
    expect(checkTokenVersion({ tokenVersion: undefined, dbVersion: 0 })).toBe("valid");
    expect(checkTokenVersion({ tokenVersion: undefined, dbVersion: 7 })).toBe("valid");
  });
  it("tokenVersion khớp dbVersion -> valid", () => {
    expect(checkTokenVersion({ tokenVersion: 2, dbVersion: 2 })).toBe("valid");
  });
});
