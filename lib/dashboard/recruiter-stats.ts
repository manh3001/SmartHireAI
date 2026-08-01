import prisma from "@/lib/db/prisma";

export async function getRecruiterStats(userId: string) {
  const [openJobs, totalApplicants, newApplicants, statusGroups, evalAgg] = await Promise.all([
    prisma.jobDescription.count({ where: { userId, isPublic: true } }),
    prisma.application.count({ where: { job: { userId } } }),
    prisma.application.count({ where: { job: { userId }, status: "SUBMITTED" } }),
    prisma.application.groupBy({
      by: ["status"],
      where: { job: { userId } },
      _count: { _all: true },
    }),
    prisma.evaluation.aggregate({
      where: { application: { job: { userId } } },
      _avg: { overallScore: true },
      _count: { _all: true },
    }),
  ]);

  return {
    openJobs,
    totalApplicants,
    newApplicants,
    statusCounts: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    avgScore:
      evalAgg._count._all === 0 || evalAgg._avg.overallScore == null
        ? null
        : Math.round(evalAgg._avg.overallScore),
  };
}
