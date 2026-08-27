import { describe, it, expect } from "vitest";
import { routeDecision } from "../route-rules";

const candidate = { user: { role: "CANDIDATE" } };
const recruiter = { user: { role: "RECRUITER" } };
const admin = { user: { role: "ADMIN" } };

describe("routeDecision", () => {
  it("route cong khai -> allow ke ca chua login", () => {
    expect(routeDecision("/jobs", null)).toBe("allow");
    expect(routeDecision("/companies", null)).toBe("allow");
    expect(routeDecision("/", null)).toBe("allow");
  });

  it("route rieng tu, chua login -> login", () => {
    expect(routeDecision("/dashboard", null)).toBe("login");
    expect(routeDecision("/cv/abc", null)).toBe("login");
    expect(routeDecision("/applications", null)).toBe("login");
  });

  it("/admin chi ADMIN", () => {
    expect(routeDecision("/admin/users", null)).toBe("login");
    expect(routeDecision("/admin/users", candidate)).toBe("forbidden");
    expect(routeDecision("/admin/users", admin)).toBe("allow");
  });

  it("/jobs/new va /company/edit chi RECRUITER", () => {
    expect(routeDecision("/jobs/new", candidate)).toBe("forbidden");
    expect(routeDecision("/jobs/new", recruiter)).toBe("allow");
    expect(routeDecision("/company/edit", candidate)).toBe("forbidden");
    expect(routeDecision("/company/edit", recruiter)).toBe("allow");
  });

  it("/jobs (list) van cong khai du co prefix giong /jobs/new", () => {
    expect(routeDecision("/jobs", null)).toBe("allow");
    expect(routeDecision("/jobs/123", null)).toBe("allow");
  });
});
