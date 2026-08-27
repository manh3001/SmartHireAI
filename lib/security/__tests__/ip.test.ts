import { describe, it, expect } from "vitest";
import { getClientIp } from "../ip";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://x", { headers });
}

describe("getClientIp", () => {
  it("lay IP dau tien tu x-forwarded-for", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("fallback x-real-ip", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("khong co header -> 'unknown'", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
    expect(getClientIp(undefined)).toBe("unknown");
  });
});
