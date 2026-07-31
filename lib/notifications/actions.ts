"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function markNotificationRead(id: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}
