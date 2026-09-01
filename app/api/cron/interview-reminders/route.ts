import prisma from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/create";
import { selectDueReminders, type DueInterview } from "@/lib/applications/reminders";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const rows = await prisma.interview.findMany({
    where: {
      reminderSentAt: null,
      scheduledAt: { gte: now, lte: limit },
    },
    select: {
      applicationId: true,
      scheduledAt: true,
      application: {
        select: {
          candidateId: true,
          job: { select: { userId: true, title: true } },
        },
      },
    },
  });

  const due: DueInterview[] = rows.map((r) => ({
    applicationId: r.applicationId,
    candidateId: r.application.candidateId,
    recruiterId: r.application.job.userId,
    jobTitle: r.application.job.title || "(chưa có tiêu đề)",
    scheduledAt: r.scheduledAt,
  }));

  const selected = selectDueReminders(due, now);

  for (const item of selected) {
    const timeStr = item.scheduledAt.toLocaleString("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const message = `Nhắc: phỏng vấn "${item.jobTitle}" vào ${timeStr}`;
    try {
      await createNotification(item.candidateId, { message, link: "/interviews" });
      await createNotification(item.recruiterId, { message, link: "/interviews" });
    } catch {
      // notify lỗi không chặn các mục còn lại
    }
    await prisma.interview.update({
      where: { applicationId: item.applicationId },
      data: { reminderSentAt: now },
    });
  }

  return Response.json({ sent: selected.length });
}
