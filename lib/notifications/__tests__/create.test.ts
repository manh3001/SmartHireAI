import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  default: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: "n1" }),
    },
  },
}));

vi.mock("@/lib/push/send", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

import { createNotification } from "../create";
import { sendPushToUser } from "@/lib/push/send";

describe("createNotification", () => {
  it("calls sendPushToUser with correct payload after DB create", async () => {
    await createNotification("user-1", {
      message: "Đơn ứng tuyển mới",
      link: "/applications",
    });
    expect(sendPushToUser).toHaveBeenCalledWith("user-1", {
      title: "SmartHire",
      message: "Đơn ứng tuyển mới",
      link: "/applications",
    });
  });

  it("does not throw if sendPushToUser rejects", async () => {
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error("push failed"));
    await expect(
      createNotification("user-2", { message: "msg", link: "/x" }),
    ).resolves.toBeUndefined();
  });
});
