import { describe, it, expect } from "vitest";
import { roleAccess } from "../session";

describe("roleAccess", () => {
  it("chua login -> login", () => {
    expect(roleAccess(null, "ADMIN")).toBe("login");
    expect(roleAccess({ user: null }, "RECRUITER")).toBe("login");
  });
  it("dung role -> ok", () => {
    expect(roleAccess({ user: { role: "ADMIN" } }, "ADMIN")).toBe("ok");
  });
  it("sai role -> forbidden", () => {
    expect(roleAccess({ user: { role: "CANDIDATE" } }, "RECRUITER")).toBe("forbidden");
  });
});
