import { describe, it, expect } from "vitest";
import { generateToken, hashToken, tokenExpiry } from "../tokens";

describe("tokens", () => {
  it("generateToken tra ve raw + hash khop hashToken(raw)", () => {
    const { raw, hash } = generateToken();
    expect(raw.length).toBeGreaterThan(20);
    expect(hash).toBe(hashToken(raw));
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("generateToken sinh raw khac nhau moi lan", () => {
    expect(generateToken().raw).not.toBe(generateToken().raw);
  });

  it("hashToken deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("tokenExpiry: EMAIL_VERIFY = 24h, PASSWORD_RESET = 1h", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(tokenExpiry("EMAIL_VERIFY", now).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(tokenExpiry("PASSWORD_RESET", now).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
});
