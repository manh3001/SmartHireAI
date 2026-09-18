import { describe, it, expect } from "vitest";
import { roleAccess } from "../session";

describe("roleAccess", () => {
  it("chua login -> login", () => {
    expect(roleAccess(null, "ADMIN")).toBe("login");
    expect(roleAccess({ user: null }, "RECRUITER")).toBe("login");
  });
  it("co user nhung thieu id -> login", () => {
    expect(roleAccess({ user: { role: "ADMIN" } }, "ADMIN")).toBe("login");
  });
  it("dung role (co id) -> ok", () => {
    expect(roleAccess({ user: { id: "u1", role: "ADMIN" } }, "ADMIN")).toBe("ok");
  });
  it("sai role (co id) -> forbidden", () => {
    expect(roleAccess({ user: { id: "u1", role: "CANDIDATE" } }, "RECRUITER")).toBe("forbidden");
  });
});
