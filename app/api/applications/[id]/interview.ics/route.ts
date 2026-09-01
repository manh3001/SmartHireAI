import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { buildIcs } from "@/lib/applications/ics";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  // Cho phép ứng viên chủ đơn HOẶC NTD chủ job
  const app = await prisma.application.findFirst({
    where: {
      id,
      OR: [{ candidateId: userId }, { job: { userId } }],
    },
    select: {
      job: { select: { title: true } },
      interview: {
        select: { scheduledAt: true, location: true, meetingLink: true, note: true },
      },
    },
  });
  if (!app || !app.interview) return new Response("Not found", { status: 404 });

  const iv = app.interview;
  const descParts = [iv.note, iv.meetingLink && `Link: ${iv.meetingLink}`].filter(Boolean);
  const ics = buildIcs({
    scheduledAt: iv.scheduledAt,
    summary: `Phỏng vấn: ${app.job.title || "(chưa có tiêu đề)"}`,
    location: iv.location,
    description: descParts.join(" — "),
    uid: id,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="interview.ics"',
    },
  });
}
