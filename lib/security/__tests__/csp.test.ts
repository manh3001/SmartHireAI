import { describe, it, expect } from "vitest";
import { buildCsp } from "../csp";

describe("buildCsp", () => {
  it("luon co default-src 'self' va khoa frame/object", () => {
    const csp = buildCsp({ isProd: true });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("production KHONG co 'unsafe-eval' trong script-src", () => {
    expect(buildCsp({ isProd: true })).not.toContain("'unsafe-eval'");
  });

  it("dev cho phep 'unsafe-eval' (Turbopack)", () => {
    expect(buildCsp({ isProd: false })).toContain("'unsafe-eval'");
  });
});

describe("buildCsp connect-src", () => {
  it("khong con dung 'https:' rong cho connect-src", () => {
    const csp = buildCsp({ isProd: true });
    expect(csp).not.toMatch(/connect-src[^;]*\bhttps:(\s|;|$)/);
    expect(csp).toMatch(/connect-src[^;]*'self'/);
  });

  it("them host Sentry khi co DSN", () => {
    const csp = buildCsp({ isProd: true, sentryDsn: "https://abc@o123.ingest.sentry.io/456" });
    expect(csp).toContain("https://o123.ingest.sentry.io");
  });
});
