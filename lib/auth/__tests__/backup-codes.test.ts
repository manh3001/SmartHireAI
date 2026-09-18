import { describe, it, expect } from "vitest";
import { generateBackupCodes, hashBackupCode } from "../backup-codes";

describe("hashBackupCode", () => {
  it("chuẩn hoá: bỏ gạch nối + không phân biệt hoa/thường", () => {
    expect(hashBackupCode("abcde-fghjk")).toBe(hashBackupCode("ABCDEFGHJK"));
    expect(hashBackupCode(" ABCDE-FGHJK ")).toBe(hashBackupCode("ABCDEFGHJK"));
  });
  it("mã khác nhau ra hash khác nhau", () => {
    expect(hashBackupCode("AAAAA-AAAAA")).not.toBe(hashBackupCode("BBBBB-BBBBB"));
  });
});

describe("generateBackupCodes", () => {
  it("sinh đúng n mã, format XXXXX-XXXXX, hashes khớp", () => {
    const { plain, hashes } = generateBackupCodes(10);
    expect(plain).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(plain[i]).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
      expect(hashes[i]).toBe(hashBackupCode(plain[i]));
    }
    expect(new Set(plain).size).toBe(10); // không trùng
  });
});
