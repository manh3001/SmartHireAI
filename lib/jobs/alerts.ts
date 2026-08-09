import type { JobsFilter } from "./job-query";
import type { JobCategory } from "./job-categories";
import { JOB_CATEGORY_LABELS } from "./job-categories";
import type { EmploymentType, ExperienceLevel } from "./job-fields";
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "./job-fields";

const MILLION = 1_000_000;

export type AlertCriteria = {
  term?: string;
  category?: JobCategory;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salaryMillions?: number | null;
};

export type MatchableJob = {
  title: string;
  company: string;
  rawText: string;
  location: string | null;
  skills: string;
  category: string | null;
  employmentType: EmploymentType | null;
  experienceLevel: ExperienceLevel | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function matchesAlert(job: MatchableJob, c: AlertCriteria): boolean {
  const term = (c.term ?? "").trim();
  if (term) {
    const hay = [job.title, job.company, job.rawText, job.location ?? "", job.skills].join(" ");
    if (!includesCI(hay, term)) return false;
  }
  if (c.category && job.category !== c.category) return false;
  if (c.employmentType && job.employmentType !== c.employmentType) return false;
  if (c.experienceLevel && job.experienceLevel !== c.experienceLevel) return false;
  if (c.salaryMillions != null) {
    const vnd = c.salaryMillions * MILLION;
    const ok =
      (job.salaryMax != null && job.salaryMax >= vnd) ||
      (job.salaryMax == null && job.salaryMin != null && job.salaryMin >= vnd);
    if (!ok) return false;
  }
  return true;
}

export function alertLabel(c: AlertCriteria): string {
  const parts: string[] = [];
  const term = (c.term ?? "").trim();
  if (term) parts.push(term);
  if (c.category) parts.push(JOB_CATEGORY_LABELS[c.category]);
  if (c.employmentType) parts.push(EMPLOYMENT_TYPE_LABELS[c.employmentType]);
  if (c.experienceLevel) parts.push(EXPERIENCE_LEVEL_LABELS[c.experienceLevel]);
  if (c.salaryMillions != null) parts.push(`Từ ${c.salaryMillions} triệu`);
  return parts.length > 0 ? parts.join(" · ") : "Tất cả việc làm";
}

export function criteriaFromFilter(f: JobsFilter): AlertCriteria {
  const c: AlertCriteria = {};
  const term = (f.term ?? "").trim();
  if (term) c.term = term;
  if (f.category) c.category = f.category;
  if (f.employmentType) c.employmentType = f.employmentType;
  if (f.experienceLevel) c.experienceLevel = f.experienceLevel;
  if (f.salaryMillions != null) c.salaryMillions = f.salaryMillions;
  return c;
}

export function criteriaToQuery(c: AlertCriteria): Record<string, string> {
  const q: Record<string, string> = {};
  const term = (c.term ?? "").trim();
  if (term) q.q = term;
  if (c.category) q.category = c.category;
  if (c.employmentType) q.type = c.employmentType;
  if (c.experienceLevel) q.level = c.experienceLevel;
  if (c.salaryMillions != null) q.salary = String(c.salaryMillions);
  return q;
}
