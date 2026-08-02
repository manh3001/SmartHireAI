import prisma from "@/lib/db/prisma";
import type { NotificationSignal } from "./poll-decision";

export async function getNotificationSignal(
  userId: string,
): Promise<NotificationSignal> {
  const [unreadCount, latest] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, message: true, link: true },
    }),
  ]);

  return { unreadCount, latest };
}
