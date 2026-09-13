import { JOB_CATEGORY_LABELS, normalizeCategory, type JobCategory } from "@/lib/jobs/job-categories";

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type CategorySalary = {
  category: JobCategory;
  label: string;
  sampleSize: number;
  medianMin: number | null;
  medianMax: number | null;
};

export function computeSalaryInsights(
  rows: { category: string | null; salaryMin: number | null; salaryMax: number | null }[],
): CategorySalary[] {
  const buckets = new Map<JobCategory, { mins: number[]; maxs: number[]; count: number }>();

  for (const r of rows) {
    if (r.salaryMin == null && r.salaryMax == null) continue;
    const cat = normalizeCategory(r.category) ?? "other";
    let b = buckets.get(cat);
    if (!b) {
      b = { mins: [], maxs: [], count: 0 };
      buckets.set(cat, b);
    }
    b.count += 1;
    if (r.salaryMin != null) b.mins.push(r.salaryMin);
    if (r.salaryMax != null) b.maxs.push(r.salaryMax);
  }

  const result: CategorySalary[] = [];
  for (const [category, b] of buckets) {
    result.push({
      category,
      label: JOB_CATEGORY_LABELS[category],
      sampleSize: b.count,
      medianMin: median(b.mins),
      medianMax: median(b.maxs),
    });
  }

  result.sort((a, b) => (b.medianMax ?? -1) - (a.medianMax ?? -1) || a.label.localeCompare(b.label, "vi"));
  return result;
}
