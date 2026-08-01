import prisma from "@/lib/db/prisma";

export async function getCandidateStats(userId: string) {
  const [cvCount, savedCount, totalApplications, statusGroups, evalAgg, events] = await Promise.all([
    prisma.cV.count({ where: { userId } }),
    prisma.savedJob.count({ where: { userId } }),
    prisma.application.count({ where: { candidateId: userId } }),
    prisma.application.groupBy({
      by: ["status"],
      where: { candidateId: userId },
      _count: { _all: true },
    }),
    prisma.evaluation.aggregate({
      where: { userId },
      _avg: { overallScore: true },
      _count: { _all: true },
    }),
    prisma.applicationEvent.findMany({
      where: { application: { candidateId: userId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        toStatus: true,
        application: { select: { job: { select: { title: true } } } },
      },
    }),
  ]);

  return {
    cvCount,
    savedCount,
    totalApplications,
    statusCounts: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    avgScore:
      evalAgg._count._all === 0 || evalAgg._avg.overallScore == null
        ? null
        : Math.round(evalAgg._avg.overallScore),
    recentEvents: events.map((e) => ({
      id: e.id,
      toStatus: e.toStatus,
      jobTitle: e.application.job.title,
    })),
  };
}
