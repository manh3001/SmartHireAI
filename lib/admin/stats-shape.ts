import { APPLICATION_STATUSES, STATUS_LABELS } from "@/lib/applications/status";

export function shapeStatusDistribution(
  groups: { status: string; count: number }[],
): { status: string; label: string; count: number }[] {
  const map = new Map(groups.map((g) => [g.status, g.count]));
  return APPLICATION_STATUSES.map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    count: map.get(s) ?? 0,
  }));
}

export function shapeRoleCounts(
  groups: { role: string; count: number }[],
): { candidates: number; recruiters: number; admins: number; total: number } {
  const get = (r: string) => groups.find((g) => g.role === r)?.count ?? 0;
  const candidates = get("CANDIDATE");
  const recruiters = get("RECRUITER");
  const admins = get("ADMIN");
  return { candidates, recruiters, admins, total: candidates + recruiters + admins };
}

export function summarizeSalaries(
  list: { salaryMin: number | null; salaryMax: number | null }[],
): { count: number; avgMidpoint: number | null; min: number | null; max: number | null } {
  const mids: number[] = [];
  let min: number | null = null;
  let max: number | null = null;
  for (const r of list) {
    if (r.salaryMin == null && r.salaryMax == null) continue;
    const lo = r.salaryMin ?? r.salaryMax!;
    const hi = r.salaryMax ?? r.salaryMin!;
    mids.push((lo + hi) / 2);
    if (min == null || lo < min) min = lo;
    if (max == null || hi > max) max = hi;
  }
  if (mids.length === 0) return { count: 0, avgMidpoint: null, min: null, max: null };
  const avg = Math.round(mids.reduce((a, b) => a + b, 0) / mids.length);
  return { count: mids.length, avgMidpoint: avg, min, max };
}
