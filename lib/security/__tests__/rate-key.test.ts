import { describe, it, expect } from "vitest";
import { rateKey } from "../rate-key";

describe("rateKey", () => {
  it("ghep scope va id theo dinh dang on dinh", () => {
    expect(rateKey("login", "1.2.3.4:a@b.com")).toBe("rl:login:1.2.3.4:a@b.com");
  });
  it("tach biet theo scope", () => {
    expect(rateKey("ai", "u1")).not.toBe(rateKey("mutation", "u1"));
  });
});
