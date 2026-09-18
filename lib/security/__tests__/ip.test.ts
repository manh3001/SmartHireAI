import { describe, it, expect, afterEach } from "vitest";
import { getClientIp, isValidIp } from "../ip";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://x", { headers });
}

afterEach(() => {
  delete process.env.CLIENT_IP_HEADER;
});

describe("isValidIp", () => {
  it("nhận IPv4 hợp lệ", () => {
    expect(isValidIp("9.9.9.9")).toBe(true);
    expect(isValidIp("192.168.0.1")).toBe(true);
  });
  it("từ chối IPv4 octet > 255", () => {
    expect(isValidIp("999.1.1.1")).toBe(false);
  });
  it("nhận IPv6 dạng cơ bản", () => {
    expect(isValidIp("::1")).toBe(true);
    expect(isValidIp("2001:db8::1")).toBe(true);
  });
  it("từ chối rác", () => {
    expect(isValidIp("not-an-ip")).toBe(false);
    expect(isValidIp("")).toBe(false);
  });
});

describe("getClientIp", () => {
  it("lấy IP đầu tiên từ x-forwarded-for", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("fallback x-real-ip", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("XFF rác -> bỏ, fallback/unknown", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "garbage" }))).toBe("unknown");
    expect(getClientIp(reqWith({ "x-forwarded-for": "garbage", "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("không có header -> 'unknown'", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
    expect(getClientIp(undefined)).toBe("unknown");
  });
  it("tôn trọng CLIENT_IP_HEADER", () => {
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    expect(getClientIp(reqWith({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
  });
});
