import prisma from "@/lib/db/prisma";
import { computeFunnel, type FunnelResult } from "./recruiter-funnel";

export async function getRecruiterFunnel(recruiterId: string): Promise<FunnelResult> {
  const [apps, events] = await Promise.all([
    prisma.application.findMany({
      where: { job: { userId: recruiterId } },
      select: { id: true },
    }),
    prisma.applicationEvent.findMany({
      where: { application: { job: { userId: recruiterId } } },
      select: { applicationId: true, toStatus: true },
    }),
  ]);
  return computeFunnel(apps, events);
}
