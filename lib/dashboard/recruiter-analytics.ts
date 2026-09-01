import prisma from "@/lib/db/prisma";
import type { ApplicationStatus } from "@prisma/client";

export type JobAnalyticsRow = {
  jobId: string;
  title: string;
  total: number;
  avgScore: number | null;
  progressRate: number;
};

export type AnalyticsSummary = {
  avgDaysToHire: number | null;
  topJobs: JobAnalyticsRow[];
};

const DAY_MS = 1000 * 60 * 60 * 24;
const NEGATIVE_STATUSES = new Set<ApplicationStatus>(["REJECTED", "WITHDRAWN"]);

export function computeAvgTimeToHire(
  apps: { id: string; createdAt: Date; status: ApplicationStatus }[],
  events: { applicationId: string; toStatus: string; createdAt: Date }[],
): number | null {
  const hiredEventMap = new Map<string, Date>();
  for (const e of events) {
    if (e.toStatus === "HIRED") hiredEventMap.set(e.applicationId, e.createdAt);
  }

  const days: number[] = [];
  for (const app of apps) {
    if (app.status !== "HIRED") continue;
    const hiredAt = hiredEventMap.get(app.id);
    if (!hiredAt) continue;
    const d = Math.round((hiredAt.getTime() - app.createdAt.getTime()) / DAY_MS);
    days.push(d);
  }

  if (days.length === 0) return null;
  return Math.round(days.reduce((sum, d) => sum + d, 0) / days.length);
}

export function computeTopJobs(
  apps: {
    id: string;
    jobId: string;
    status: ApplicationStatus;
    job: { id: string; title: string };
    evaluation: { overallScore: number } | null;
  }[],
): JobAnalyticsRow[] {
  const jobMap = new Map<string, { title: string; total: number; scores: number[]; progressive: number }>();

  for (const app of apps) {
    if (!jobMap.has(app.jobId)) {
      jobMap.set(app.jobId, { title: app.job.title, total: 0, scores: [], progressive: 0 });
    }
    const entry = jobMap.get(app.jobId)!;
    entry.total++;
    if (app.evaluation) entry.scores.push(app.evaluation.overallScore);
    if (!NEGATIVE_STATUSES.has(app.status)) entry.progressive++;
  }

  return Array.from(jobMap.entries())
    .map(([jobId, { title, total, scores, progressive }]) => ({
      jobId,
      title,
      total,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
      progressRate: total > 0 ? progressive / total : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

export async function getRecruiterAnalytics(recruiterId: string): Promise<AnalyticsSummary> {
  const [apps, hiredEvents] = await Promise.all([
    prisma.application.findMany({
      where: { job: { userId: recruiterId } },
      select: {
        id: true,
        jobId: true,
        createdAt: true,
        status: true,
        job: { select: { id: true, title: true } },
        evaluation: { select: { overallScore: true } },
      },
    }),
    prisma.applicationEvent.findMany({
      where: {
        toStatus: "HIRED",
        application: { job: { userId: recruiterId } },
      },
      select: { applicationId: true, toStatus: true, createdAt: true },
    }),
  ]);

  return {
    avgDaysToHire: computeAvgTimeToHire(apps, hiredEvents),
    topJobs: computeTopJobs(apps),
  };
}
