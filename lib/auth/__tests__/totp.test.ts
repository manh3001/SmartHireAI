import { describe, it, expect } from "vitest";
import {
  base32Encode, base32Decode, generateSecret, totpUri, generateTotp, verifyTotp,
} from "../totp";

describe("base32", () => {
  it("roundtrip", () => {
    const buf = Buffer.from("12345678901234567890");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });
});

describe("generateSecret", () => {
  it("sinh base32 đủ dài, khác nhau", () => {
    const a = generateSecret();
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(generateSecret()).not.toBe(a);
  });
});

describe("generateTotp (RFC 6238 SHA-1 vectors)", () => {
  // Secret chuẩn RFC: ASCII "12345678901234567890"
  const SECRET = base32Encode(Buffer.from("12345678901234567890"));
  it("khớp vector tại T=59s và T=1111111109s", () => {
    expect(generateTotp(SECRET, 59_000)).toBe("94287082");
    expect(generateTotp(SECRET, 1_111_111_109_000)).toBe("07081804");
  });
});

describe("verifyTotp", () => {
  const secret = generateSecret();
  const now = 1_700_000_000_000;
  it("chấp nhận mã đúng ở thời điểm hiện tại", () => {
    expect(verifyTotp(secret, generateTotp(secret, now), { now })).toBe(true);
  });
  it("chấp nhận mã ở cửa sổ liền kề (±30s)", () => {
    expect(verifyTotp(secret, generateTotp(secret, now - 30_000), { now })).toBe(true);
  });
  it("từ chối mã ngoài cửa sổ", () => {
    expect(verifyTotp(secret, generateTotp(secret, now - 120_000), { now })).toBe(false);
  });
  it("từ chối mã sai định dạng", () => {
    expect(verifyTotp(secret, "abc", { now })).toBe(false);
    expect(verifyTotp(secret, "000000", { now })).toBe(false);
  });
});

describe("totpUri", () => {
  it("chứa secret, issuer, email", () => {
    const uri = totpUri({ secret: "ABC", email: "a@b.com", issuer: "SmartHire" });
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABC");
    expect(uri).toContain("issuer=SmartHire");
  });
});
