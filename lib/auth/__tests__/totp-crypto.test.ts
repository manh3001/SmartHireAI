import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "../totp-crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-auth-secret-least-32-characters-long";
});

describe("totp-crypto", () => {
  it("roundtrip decrypt(encrypt(x)) === x", () => {
    const s = "JBSWY3DPEHPK3PXP";
    expect(decryptSecret(encryptSecret(s))).toBe(s);
  });
  it("hai lần mã hoá cùng input ra khác nhau (IV ngẫu nhiên) nhưng đều giải đúng", () => {
    const s = "HELLOWORLDSECRET";
    const a = encryptSecret(s), b = encryptSecret(s);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(s);
    expect(decryptSecret(b)).toBe(s);
  });
});
