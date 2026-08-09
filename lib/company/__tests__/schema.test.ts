import { describe, it, expect } from "vitest";
import { companySchema } from "../schema";

const base = {
  name: "ACME",
  description: "Công ty công nghệ",
  website: "https://acme.vn",
  location: "Hà Nội",
};

describe("companySchema", () => {
  it("chấp nhận input hợp lệ", () => {
    expect(companySchema.safeParse(base).success).toBe(true);
  });

  it("chấp nhận khi chỉ có tên (các trường khác rỗng)", () => {
    const r = companySchema.safeParse({ name: "ACME", description: "", website: "", location: "" });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu tên", () => {
    const r = companySchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Vui lòng nhập tên công ty");
  });

  it("sanitize javascript:alert(1) in website to empty string", () => {
    const r = companySchema.safeParse({ ...base, website: "javascript:alert(1)" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBe("");
  });

  it("preserve https:// URLs in website", () => {
    const r = companySchema.safeParse({ ...base, website: "https://example.com" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBe("https://example.com");
  });
});
