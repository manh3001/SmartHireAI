import { describe, it, expect, afterEach } from "vitest";
import { siteUrl, absoluteUrl } from "../url";

const original = process.env.APP_URL;
afterEach(() => { process.env.APP_URL = original; });

describe("siteUrl / absoluteUrl", () => {
  it("bỏ dấu / cuối của APP_URL", () => {
    process.env.APP_URL = "https://smarthire.vn/";
    expect(siteUrl()).toBe("https://smarthire.vn");
  });
  it("fallback localhost khi thiếu APP_URL", () => {
    delete process.env.APP_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });
  it("absoluteUrl ghép path có/không dấu /", () => {
    process.env.APP_URL = "https://smarthire.vn";
    expect(absoluteUrl("/jobs/x")).toBe("https://smarthire.vn/jobs/x");
    expect(absoluteUrl("jobs/x")).toBe("https://smarthire.vn/jobs/x");
  });
});
