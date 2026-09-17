import { describe, it, expect } from "vitest";
import { isTrustedOrigin } from "../origin";

describe("isTrustedOrigin", () => {
  const APP = "https://app.example.com";

  it("origin khop host -> true", () => {
    expect(isTrustedOrigin({ origin: "https://app.example.com", referer: null, host: "app.example.com" })).toBe(true);
  });

  it("origin khop APP_URL -> true", () => {
    expect(isTrustedOrigin({ origin: "https://app.example.com", referer: null, host: null }, APP)).toBe(true);
  });

  it("origin la site khac -> false", () => {
    expect(isTrustedOrigin({ origin: "https://evil.com", referer: null, host: "app.example.com" }, APP)).toBe(false);
  });

  it("khong co origin nhung referer cung host -> true", () => {
    expect(isTrustedOrigin({ origin: null, referer: "https://app.example.com/jobs", host: "app.example.com" })).toBe(true);
  });

  it("khong co origin lan referer -> true (khong the xac dinh, cho qua)", () => {
    expect(isTrustedOrigin({ origin: null, referer: null, host: "app.example.com" })).toBe(true);
  });

  it("referer site khac -> false", () => {
    expect(isTrustedOrigin({ origin: null, referer: "https://evil.com/x", host: "app.example.com" })).toBe(false);
  });
});
