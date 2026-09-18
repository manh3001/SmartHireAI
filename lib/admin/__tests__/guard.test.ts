import { describe, it, expect } from "vitest";
import { adminAccess } from "../guard";

describe("adminAccess", () => {
  it("null session -> login", () => {
    expect(adminAccess(null)).toBe("login");
  });
  it("session không có user -> login", () => {
    expect(adminAccess({} as never)).toBe("login");
  });
  it("CANDIDATE -> forbidden", () => {
    expect(adminAccess({ user: { id: "u1", role: "CANDIDATE" } })).toBe("forbidden");
  });
  it("RECRUITER -> forbidden", () => {
    expect(adminAccess({ user: { id: "u1", role: "RECRUITER" } })).toBe("forbidden");
  });
  it("ADMIN -> ok", () => {
    expect(adminAccess({ user: { id: "u1", role: "ADMIN" } })).toBe("ok");
  });
});
