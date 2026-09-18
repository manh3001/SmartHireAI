import { describe, it, expect } from "vitest";
import { verifyEmailHtml, resetPasswordHtml } from "../templates";

describe("email templates", () => {
  it("verifyEmailHtml chua link + loi keu goi", () => {
    const html = verifyEmailHtml("https://app/verify-email?token=abc");
    expect(html).toContain("https://app/verify-email?token=abc");
    expect(html.toLowerCase()).toContain("xác minh");
  });

  it("resetPasswordHtml chua link + het han 1 gio", () => {
    const html = resetPasswordHtml("https://app/reset-password?token=xyz");
    expect(html).toContain("https://app/reset-password?token=xyz");
    expect(html).toContain("1 giờ");
  });
});
