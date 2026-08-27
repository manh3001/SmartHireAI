import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "../ratelimit";

// Không set UPSTASH_* -> dùng backend in-memory, deterministic theo `now`.
describe("checkRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("cho qua toi da 'max' lan roi chan (scope register: 5/gio)", async () => {
    const id = "ip-A"; // id riêng để không đụng test khác
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit("register", id, 1000 + i)).toBe(true);
    }
    expect(await checkRateLimit("register", id, 1010)).toBe(false);
  });

  it("tach biet theo id", async () => {
    expect(await checkRateLimit("login", "ip-B:e", 0)).toBe(true);
    expect(await checkRateLimit("login", "ip-C:e", 0)).toBe(true);
  });
});
