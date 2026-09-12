export type JobBadge = { label: string; tone: "new" | "salary" };

export const HIGH_SALARY_VND = 40_000_000;
export const NEW_JOB_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function jobBadges(
  job: { createdAt?: string | Date | null; salaryMax?: number | null },
  now: Date = new Date(),
): JobBadge[] {
  const badges: JobBadge[] = [];

  if (job.createdAt != null) {
    const created = new Date(job.createdAt).getTime();
    const ageDays = (now.getTime() - created) / DAY_MS;
    if (ageDays >= 0 && ageDays <= NEW_JOB_DAYS) {
      badges.push({ label: "Mới", tone: "new" });
    }
  }

  if (job.salaryMax != null && job.salaryMax >= HIGH_SALARY_VND) {
    badges.push({ label: "Lương cao", tone: "salary" });
  }

  return badges;
}
