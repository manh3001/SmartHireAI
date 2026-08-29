import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  default: {
    notification: {
      count: vi.fn().mockResolvedValue(3),
      findFirst: vi.fn().mockResolvedValue({
        id: "n1",
        message: "Đơn ứng tuyển mới",
        link: "/applications",
      }),
    },
  },
}));

import { getNotificationSignalRaw } from "../poll";

describe("getNotificationSignalRaw", () => {
  it("returns unreadCount and latest from DB", async () => {
    const signal = await getNotificationSignalRaw("user-1");
    expect(signal.unreadCount).toBe(3);
    expect(signal.latest).toEqual({
      id: "n1",
      message: "Đơn ứng tuyển mới",
      link: "/applications",
    });
  });

  it("returns null latest when no notifications", async () => {
    const { default: prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.notification.findFirst).mockResolvedValueOnce(null);
    const signal = await getNotificationSignalRaw("user-2");
    expect(signal.latest).toBeNull();
  });
});
