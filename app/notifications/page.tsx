import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import NotificationItem from "./NotificationItem";
import MarkAllButton from "./MarkAllButton";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true, link: true, read: true, createdAt: true },
  });
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Thông báo</h1>
          {hasUnread && <MarkAllButton />}
        </div>
        {notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                message={n.message}
                link={n.link}
                read={n.read}
                time={new Date(n.createdAt).toLocaleString("vi-VN")}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
