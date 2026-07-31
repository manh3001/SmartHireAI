import { describe, it, expect } from "vitest";
import { messageSchema } from "../schema";

describe("messageSchema", () => {
  it("chấp nhận body hợp lệ", () => {
    expect(messageSchema.safeParse({ body: "xin chào" }).success).toBe(true);
  });

  it("từ chối body rỗng", () => {
    const r = messageSchema.safeParse({ body: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Vui lòng nhập nội dung");
  });

  it("từ chối body quá dài", () => {
    const r = messageSchema.safeParse({ body: "x".repeat(2001) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Tin nhắn tối đa 2000 ký tự");
  });
});
