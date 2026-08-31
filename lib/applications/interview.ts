"use server";

import { auth } from "@/auth";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/create";
import {
  runScheduleInterview,
  type InterviewData,
  type ScheduleInterviewDeps,
} from "./interview-logic";

export type { InterviewData };

export async function scheduleInterview(
  applicationId: string,
  data: InterviewData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng" };

  const deps: ScheduleInterviewDeps = {
    findApplicationForRecruiter: (appId, recruiterId) =>
      prisma.application.findFirst({
        where: { id: appId, job: { userId: recruiterId } },
        select: { id: true, candidateId: true },
      }),
    upsertInterview: async (appId, d) => {
      await prisma.interview.upsert({
        where: { applicationId: appId },
        create: {
          applicationId: appId,
          scheduledAt: d.scheduledAt,
          location: d.location,
          meetingLink: d.meetingLink,
          note: d.note,
        },
        update: {
          scheduledAt: d.scheduledAt,
          location: d.location,
          meetingLink: d.meetingLink,
          note: d.note,
        },
      });
    },
    notifyCandidate: (candidateId, message, link) =>
      createNotification(candidateId, { message, link }),
  };

  const outcome = await runScheduleInterview(
    {
      applicationId,
      recruiterId: userId,
      recruiterName: session.user.name ?? "Nhà tuyển dụng",
      data,
    },
    deps,
  );
  if (outcome.ok) revalidateTag(CACHE_TAGS.applications, "max");
  return outcome;
}
