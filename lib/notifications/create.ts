import prisma from "@/lib/db/prisma";

export async function createNotification(
  userId: string,
  data: { message: string; link: string },
): Promise<void> {
  await prisma.notification.create({
    data: { userId, message: data.message, link: data.link },
  });
}
