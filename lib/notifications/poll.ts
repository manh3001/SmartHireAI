import { unstable_cache } from "next/cache";
import prisma from "@/lib/db/prisma";
import type { NotificationSignal } from "./poll-decision";
import { CACHE_TAGS } from "@/lib/cache/tags";

export async function getNotificationSignalRaw(
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

const getCachedSignal = unstable_cache(
  getNotificationSignalRaw,
  ["notification-signal"],
  { tags: [CACHE_TAGS.notifications], revalidate: 60 },
);

export async function getNotificationSignal(
  userId: string,
): Promise<NotificationSignal> {
  return getCachedSignal(userId);
}
