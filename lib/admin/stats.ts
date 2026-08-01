import prisma from "@/lib/db/prisma";
import { shapeRoleCounts, summarizeSalaries } from "./stats-shape";
import { shapeStatusDistribution } from "@/lib/applications/status";

export async function getAdminStats() {
  const [
    roleGroups,
    cvCount,
    jdTotal,
    jdPublic,
    companyCount,
    appCount,
    statusGroups,
    evalAgg,
    screeningCount,
    salaryRows,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.cV.count(),
    prisma.jobDescription.count(),
    prisma.jobDescription.count({ where: { isPublic: true } }),
    prisma.companyProfile.count(),
    prisma.application.count(),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.evaluation.aggregate({ _count: { _all: true }, _avg: { overallScore: true } }),
    prisma.screening.count(),
    prisma.jobDescription.findMany({ select: { salaryMin: true, salaryMax: true } }),
  ]);

  return {
    roles: shapeRoleCounts(roleGroups.map((g) => ({ role: g.role, count: g._count._all }))),
    cvCount,
    jdTotal,
    jdPublic,
    companyCount,
    appCount,
    statusDistribution: shapeStatusDistribution(
      statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    ),
    ai: {
      evaluations: evalAgg._count._all,
      avgScore: evalAgg._avg.overallScore == null ? null : Math.round(evalAgg._avg.overallScore),
      screenings: screeningCount,
    },
    salary: summarizeSalaries(salaryRows),
  };
}
