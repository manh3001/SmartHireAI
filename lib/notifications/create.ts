import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { sendPushToUser } from "@/lib/push/send";

export async function createNotification(
  userId: string,
  data: { message: string; link: string },
): Promise<void> {
  await prisma.notification.create({
    data: { userId, message: data.message, link: data.link },
  });
  revalidateTag(CACHE_TAGS.notifications, "max");
  sendPushToUser(userId, {
    title: "SmartHire",
    message: data.message,
    link: data.link,
  }).catch((e) => console.warn("[push]", e));
}
