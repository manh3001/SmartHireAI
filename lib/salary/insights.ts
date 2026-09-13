import { JOB_CATEGORY_LABELS, normalizeCategory, type JobCategory } from "@/lib/jobs/job-categories";
import { EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS, type ExperienceLevel } from "@/lib/jobs/job-fields";

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

export type SalaryBarRow = {
  label: string;
  sampleSize: number;
  medianMin: number | null;
  medianMax: number | null;
};

export const MIN_SKILL_SAMPLE = 3;

type SalaryRow = { salaryMin: number | null; salaryMax: number | null };
type Bucket = { mins: number[]; maxs: number[]; count: number };

function newBucket(): Bucket {
  return { mins: [], maxs: [], count: 0 };
}

function hasSalary(row: SalaryRow): boolean {
  return row.salaryMin != null || row.salaryMax != null;
}

function addRow(b: Bucket, row: SalaryRow): void {
  b.count += 1;
  if (row.salaryMin != null) b.mins.push(row.salaryMin);
  if (row.salaryMax != null) b.maxs.push(row.salaryMax);
}

function bySalaryDesc(a: SalaryBarRow, b: SalaryBarRow): number {
  return (b.medianMax ?? -1) - (a.medianMax ?? -1) || a.label.localeCompare(b.label, "vi");
}

export function computeSalaryInsights(
  rows: { category: string | null; salaryMin: number | null; salaryMax: number | null }[],
): CategorySalary[] {
  const buckets = new Map<JobCategory, Bucket>();
  for (const r of rows) {
    if (!hasSalary(r)) continue;
    const cat = normalizeCategory(r.category) ?? "other";
    let b = buckets.get(cat);
    if (!b) {
      b = newBucket();
      buckets.set(cat, b);
    }
    addRow(b, r);
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
  result.sort(bySalaryDesc);
  return result;
}

export function computeSalaryByLevel(
  rows: { experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[],
): SalaryBarRow[] {
  const buckets = new Map<ExperienceLevel, Bucket>();
  for (const r of rows) {
    if (!hasSalary(r)) continue;
    if (r.experienceLevel == null || !(EXPERIENCE_LEVELS as readonly string[]).includes(r.experienceLevel)) continue;
    const level = r.experienceLevel as ExperienceLevel;
    let b = buckets.get(level);
    if (!b) {
      b = newBucket();
      buckets.set(level, b);
    }
    addRow(b, r);
  }

  const result: SalaryBarRow[] = [];
  for (const level of EXPERIENCE_LEVELS) {
    const b = buckets.get(level);
    if (!b) continue;
    result.push({
      label: EXPERIENCE_LEVEL_LABELS[level],
      sampleSize: b.count,
      medianMin: median(b.mins),
      medianMax: median(b.maxs),
    });
  }
  return result;
}

export function computeSalaryBySkill(
  rows: { skills: string; salaryMin: number | null; salaryMax: number | null }[],
  limit = 8,
): SalaryBarRow[] {
  const buckets = new Map<string, { label: string; bucket: Bucket }>();
  for (const r of rows) {
    if (!hasSalary(r)) continue;
    const seen = new Set<string>();
    for (const raw of (r.skills ?? "").split(",")) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let entry = buckets.get(key);
      if (!entry) {
        entry = { label: skill, bucket: newBucket() };
        buckets.set(key, entry);
      }
      addRow(entry.bucket, r);
    }
  }

  const result: SalaryBarRow[] = [];
  for (const { label, bucket } of buckets.values()) {
    if (bucket.count < MIN_SKILL_SAMPLE) continue;
    result.push({
      label,
      sampleSize: bucket.count,
      medianMin: median(bucket.mins),
      medianMax: median(bucket.maxs),
    });
  }
  result.sort(bySalaryDesc);
  return result.slice(0, limit);
}
