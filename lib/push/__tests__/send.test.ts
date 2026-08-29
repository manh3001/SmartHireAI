import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  default: {
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("isPushConfigured", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = saved;
  });

  it("returns false when VAPID vars are missing", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    const { isPushConfigured } = await import("../send");
    expect(isPushConfigured()).toBe(false);
  });

  it("returns true when all three VAPID vars are present", async () => {
    process.env.VAPID_PUBLIC_KEY = "pubkey";
    process.env.VAPID_PRIVATE_KEY = "privkey";
    process.env.VAPID_SUBJECT = "mailto:test@test.com";
    const { isPushConfigured } = await import("../send");
    expect(isPushConfigured()).toBe(true);
  });
});
